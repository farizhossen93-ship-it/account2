import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { createServer as createViteServer } from 'vite';
import { dbService } from './server/db.js';
import { decrypt } from './server/crypto.js';
import { AccountCategory } from './src/types.js';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Helper to ensure database directories are clean
if (!fs.existsSync(path.join(process.cwd(), 'server'))) {
  fs.mkdirSync(path.join(process.cwd(), 'server'), { recursive: true });
}

// Global simple IP logging or similar if needed (no unrequested telemetry, just standard logs)
app.use((req, res, next) => {
  next();
});

// Auth Middleware
function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Auth token missing. Please sign in.' });
  }

  const token = authHeader.split(' ')[1];
  const userId = dbService.getUserIdFromSession(token);
  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }

  (req as any).userId = userId;
  (req as any).sessionToken = token;
  next();
}

//-----------------------------------------------------------------------------
// PUBLIC AUTH ENDPOINTS
//-----------------------------------------------------------------------------

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields (Name, Email, Password) are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const result = dbService.signUp(name, email, password);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  const token = dbService.createSession(result.user!.id, false);
  dbService.logAction(result.user!.id, 'SIGNUP', `Registered account for email ${email}`);

  res.status(201).json({
    token,
    user: {
      id: result.user!.id,
      name: result.user!.name,
      email: result.user!.email,
      createdAt: result.user!.createdAt,
      is2FAEnabled: result.user!.is2FAEnabled
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password, rememberMe } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const result = dbService.login(email, password);
  if (!result.success) {
    return res.status(401).json({ error: result.error });
  }

  const token = dbService.createSession(result.userId!, !!rememberMe);
  const user = dbService.getUserById(result.userId!);
  dbService.logAction(result.userId!, 'LOGIN', 'Authenticated successfully');

  res.json({
    token,
    user: {
      id: user!.id,
      name: user!.name,
      email: user!.email,
      createdAt: user!.createdAt,
      is2FAEnabled: user!.is2FAEnabled
    }
  });
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  const token = (req as any).sessionToken;
  const userId = (req as any).userId;
  dbService.deleteSession(token);
  dbService.logAction(userId, 'LOGIN', 'Logged out of session');
  res.json({ success: true });
});

//-----------------------------------------------------------------------------
// SECURED USER & PROFILE ENDPOINTS
//-----------------------------------------------------------------------------

app.get('/api/auth/me', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const user = dbService.getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    is2FAEnabled: user.is2FAEnabled
  });
});

app.put('/api/auth/profile', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const { name, email, is2FAEnabled, currentPassword, newPassword } = req.body;

  const result = dbService.updateUserProfile(userId, { name, email, is2FAEnabled, currentPassword, newPassword });
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  dbService.logAction(userId, 'UPDATE_PROFILE', 'Updated profile information/settings');
  const user = dbService.getUserById(userId);
  res.json({
    success: true,
    user: {
      id: user!.id,
      name: user!.name,
      email: user!.email,
      createdAt: user!.createdAt,
      is2FAEnabled: user!.is2FAEnabled
    }
  });
});

app.delete('/api/auth/profile', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const token = (req as any).sessionToken;
  
  dbService.logAction(userId, 'UPDATE_PROFILE', 'Deleted personal profile vault permanently');
  const success = dbService.deleteUserAccount(userId);
  if (!success) {
    return res.status(404).json({ error: 'User reference mismatch.' });
  }

  res.json({ success: true, message: 'All details deleted successfully.' });
});

//-----------------------------------------------------------------------------
// SECURED ACCOUNTS ENDPOINTS
//-----------------------------------------------------------------------------

app.get('/api/accounts', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const includeDeleted = req.query.includeDeleted === 'true';
  const accounts = dbService.getAccounts(userId, includeDeleted);
  res.json(accounts);
});

app.post('/api/accounts', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const newAcc = dbService.createAccount(userId, req.body);
  dbService.logAction(userId, 'EDIT_ACCOUNT', `Created account '${newAcc.title}' under category '${newAcc.category}'`);
  res.status(201).json(newAcc);
});

app.put('/api/accounts/:id', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const accountId = req.params.id;
  
  const updated = dbService.updateAccount(userId, accountId, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Account not found.' });
  }
  
  dbService.logAction(userId, 'EDIT_ACCOUNT', `Modified details of account '${updated.title}'`);
  res.json(updated);
});

// REVEAL SECURE FIELDS FOR SECURE RENDERING + LOG ACTION
app.get('/api/accounts/:id/reveal', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const accountId = req.params.id;
  const account = dbService.getAccountById(userId, accountId);
  
  if (!account) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  // Decrypt variables
  const passwordSeed = decrypt(account.passwordEncrypted);
  const recoveryEmail = account.recoveryEmailEncrypted ? decrypt(account.recoveryEmailEncrypted) : '';
  const recoveryPhone = account.recoveryPhoneEncrypted ? decrypt(account.recoveryPhoneEncrypted) : '';
  const backupCodes = account.backupCodesEncrypted ? decrypt(account.backupCodesEncrypted) : '';
  const securityQuestions = account.securityQuestionsEncrypted ? JSON.parse(decrypt(account.securityQuestionsEncrypted)) : [];
  const authenticatorSecretKey = account.authenticatorSecretKeyEncrypted ? decrypt(account.authenticatorSecretKeyEncrypted) : '';

  dbService.logAction(userId, 'VIEW_PASSWORD', `Revealed sensitive/password details for account '${account.title}'`);

  res.json({
    id: account.id,
    password: passwordSeed,
    recoveryEmail,
    recoveryPhone,
    backupCodes,
    securityQuestions,
    authenticatorSecretKey
  });
});

app.delete('/api/accounts/:id', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const accountId = req.params.id;
  const permanent = req.query.permanent === 'true';

  const account = dbService.getAccountById(userId, accountId);
  if (!account) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  if (permanent) {
    dbService.deleteAccountPermanently(userId, accountId);
    dbService.logAction(userId, 'DELETE_ACCOUNT', `Permanently deleted account record inside vault: '${account.title}'`);
  } else {
    dbService.updateAccount(userId, accountId, { isDeleted: true });
    dbService.logAction(userId, 'DELETE_ACCOUNT', `Moved account '${account.title}' to trash bin`);
  }

  res.json({ success: true });
});

app.post('/api/trash/empty', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const count = dbService.emptyTrashBin(userId);
  dbService.logAction(userId, 'EMPTY_TRASH', 'Permanently emptied all trashed accounts and notes');
  res.json({ success: true, count });
});

//-----------------------------------------------------------------------------
// SECURED NOTES VAULT ENDPOINTS
//-----------------------------------------------------------------------------

app.get('/api/notes', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const includeDeleted = req.query.includeDeleted === 'true';
  const notes = dbService.getNotes(userId, includeDeleted);
  res.json(notes);
});

app.post('/api/notes', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const note = dbService.createNote(userId, req.body);
  dbService.logAction(userId, 'CREATE_NOTE', `Created secure note '${note.title}'`);
  res.status(201).json(note);
});

app.put('/api/notes/:id', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const noteId = req.params.id;
  const updated = dbService.updateNote(userId, noteId, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Note not found.' });
  }
  dbService.logAction(userId, 'EDIT_NOTE', `Updated secure note details: '${updated.title}'`);
  res.json(updated);
});

app.get('/api/notes/:id/reveal', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const noteId = req.params.id;
  const notes = dbService.getNotes(userId, true);
  const note = notes.find(n => n.id === noteId);
  if (!note) {
    return res.status(404).json({ error: 'Note not found.' });
  }

  const plainContent = decrypt(note.contentEncrypted);
  dbService.logAction(userId, 'EDIT_NOTE', `Accessed private note decrypted payload: '${note.title}'`);
  res.json({ content: plainContent });
});

app.delete('/api/notes/:id', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const noteId = req.params.id;
  const permanent = req.query.permanent === 'true';

  const notes = dbService.getNotes(userId, true);
  const note = notes.find(n => n.id === noteId);
  if (!note) {
    return res.status(404).json({ error: 'Note not found.' });
  }

  if (permanent) {
    dbService.deleteNotePermanently(userId, noteId);
    dbService.logAction(userId, 'DELETE_NOTE', `Permanently deleted note: '${note.title}'`);
  } else {
    dbService.updateNote(userId, noteId, { isDeleted: true });
    dbService.logAction(userId, 'DELETE_NOTE', `Moved secure note '${note.title}' to trash bin`);
  }

  res.json({ success: true });
});

//-----------------------------------------------------------------------------
// AUDIT LOGS
//-----------------------------------------------------------------------------

app.get('/api/logs', authenticate, (req, res) => {
  const userId = (req as any).userId;
  res.json(dbService.getLogs(userId));
});

//-----------------------------------------------------------------------------
// COMPLEX ANALYTICS & STATS
//-----------------------------------------------------------------------------

app.get('/api/stats', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const activeAccounts = dbService.getAccounts(userId, false);
  const notes = dbService.getNotes(userId, false);

  const totalAccounts = activeAccounts.length;
  const totalGmailAccounts = activeAccounts.filter(a => a.category === 'Gmail' || a.platformName.toLowerCase().includes('gmail') || a.platformName.toLowerCase().includes('google')).length;
  const totalWebsites = activeAccounts.filter(a => !!a.websiteUrl).length;
  const totalCryptoAccounts = activeAccounts.filter(a => a.category === 'Crypto').length;
  const totalSavedPasswords = activeAccounts.filter(a => !!a.passwordEncrypted).length;

  // Recent 5 added items
  const sortedByDate = [...activeAccounts].sort((a,b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
  const recentlyAdded = sortedByDate.slice(0, 5).map(a => ({
    id: a.id,
    title: a.title,
    category: a.category,
    platform: a.platformName,
    date: a.creationDate
  }));

  // Balance computation with simple conversions
  // BDT -> USD is /115, INR -> USD is /83, EUR -> USD is *1.08, GBP -> USD is *1.25, BTC -> USD is *68000, ETH -> USD is *3400
  let totalBalanceUSD = 0;
  activeAccounts.forEach(a => {
    let amt = a.balance;
    if (a.currency === 'BDT') amt /= 115;
    else if (a.currency === 'INR') amt /= 83;
    else if (a.currency === 'EUR') amt *= 1.08;
    else if (a.currency === 'GBP') amt *= 1.25;
    else if (a.currency === 'BTC') amt *= 68000;
    else if (a.currency === 'ETH') amt *= 3400;
    
    totalBalanceUSD += amt;
  });

  // Password Health Calculation
  let weakCount = 0;
  let reusedCount = 0;
  let oldCount = 0;

  const passwordMap: { [plain: string]: number } = {};
  const plainPasswords = activeAccounts.map(a => {
    const plain = decrypt(a.passwordEncrypted);
    if (plain) {
      passwordMap[plain] = (passwordMap[plain] || 0) + 1;
    }
    return { id: a.id, plain, creationDate: a.creationDate };
  });

  for (const p of plainPasswords) {
    const plain = p.plain;
    // Weak factors: length < 8, no capital, no number, no symbol
    const isWeak = plain.length < 8 || 
                   !/[A-Z]/.test(plain) || 
                   !/[0-9]/.test(plain) || 
                   !/[!@#$%^&*(),.?":{}|<>]/.test(plain);
    if (isWeak) weakCount++;

    if (passwordMap[plain] && passwordMap[plain] > 1) {
      reusedCount++;
    }

    const ageDays = (Date.now() - new Date(p.creationDate).getTime()) / (1000 * 3600 * 24);
    if (ageDays > 90) {
      oldCount++;
    }
  }

  let securityScore = 100;
  if (totalAccounts > 0) {
    const weakRatio = weakCount / totalAccounts;
    const reusedRatio = reusedCount / totalAccounts;
    const oldRatio = oldCount / totalAccounts;
    securityScore = Math.max(0, Math.round(100 - (weakRatio * 35) - (reusedRatio * 45) - (oldRatio * 20)));
  }

  res.json({
    stats: {
      totalAccounts,
      totalGmailAccounts,
      totalWebsites,
      totalCryptoAccounts,
      totalSavedPasswords,
      recentlyAdded,
      totalBalanceUSD
    },
    health: {
      weakCount,
      reusedCount,
      oldCount,
      securityScore
    }
  });
});

//-----------------------------------------------------------------------------
// IMPORTS AND EXPORTS VAULT
//-----------------------------------------------------------------------------

// DECRYPTED JSON BULK EXPORT
app.get('/api/export/vault', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const format = req.query.format || 'json';

  const plainData = dbService.getPlaintextVaultData(userId);
  dbService.logAction(userId, 'EXPORT_VAULT', `Exported entire digital vault in format: ${format}`);

  if (format === 'csv') {
    // Generate simple CSV
    let csv = 'AccountTitle,PlatformName,Category,WebsiteURL,Username,LoginEmail,Password,RecoveryEmail,RecoveryPhone,Balance,Currency,Notes,Tags\n';
    plainData.accounts.forEach(a => {
      const cleanTitle = (a.title || '').replace(/"/g, '""');
      const cleanPlatform = (a.platformName || '').replace(/"/g, '""');
      const cleanCategory = (a.category || '').replace(/"/g, '""');
      const cleanSite = (a.websiteUrl || '').replace(/"/g, '""');
      const cleanUser = (a.username || '').replace(/"/g, '""');
      const cleanEmail = (a.loginEmail || '').replace(/"/g, '""');
      const cleanPass = (a.password || '').replace(/"/g, '""');
      const cleanRecEmail = (a.recoveryEmail || '').replace(/"/g, '""');
      const cleanRecPhone = (a.recoveryPhone || '').replace(/"/g, '""');
      const cleanNotes = (a.notes || '').replace(/"/g, '""').replace(/\n/g, ' ');
      const cleanTags = (a.tags || []).join(';');
      
      csv += `"${cleanTitle}","${cleanPlatform}","${cleanCategory}","${cleanSite}","${cleanUser}","${cleanEmail}","${cleanPass}","${cleanRecEmail}","${cleanRecPhone}",${a.balance},"${a.currency}","${cleanNotes}","${cleanTags}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=digital_vault_export.csv');
    return res.send(csv);
  }

  // JSON format
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=digital_vault_export.json');
  res.json(plainData);
});

// BULK RESTORE FROM CSV/JSON
app.post('/api/import/vault', authenticate, (req, res) => {
  const userId = (req as any).userId;
  const { rows } = req.body;

  if (!rows || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'Import payload must contain a valid dataset of accounts.' });
  }

  const count = dbService.importAccountsFromRows(userId, rows);
  dbService.logAction(userId, 'IMPORT_VAULT', `Successfully loaded ${count} account records from bulk imported template`);

  res.json({ success: true, count });
});

//-----------------------------------------------------------------------------
// HOST BOTH DEV VITE OR PRODUCTION FRONTEND BINDINGS
//-----------------------------------------------------------------------------

async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Digital Vault Pro Server active at: http://localhost:${PORT}`);
  });
}

startServer();
