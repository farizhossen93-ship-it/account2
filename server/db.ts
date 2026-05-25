import fs from 'node:fs';
import path from 'node:path';
import { Account, Note, ActivityLog, CurrencyCode, AccountCategory } from '../src/types.js';
import { encrypt, decrypt, hashPassword, generateSalt } from './crypto.js';

const DB_DIR = path.join(process.cwd(), 'server');
const DB_FILE = path.join(DB_DIR, 'db.json');

interface UserEntry {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  is2FAEnabled: boolean;
  twoFactorSecret?: string;
}

interface DatabaseSchema {
  users: UserEntry[];
  accounts: Account[];
  notes: Note[];
  activityLogs: ActivityLog[];
  sessions: { [token: string]: { userId: string; expiresAt: number } };
}

// Initial/default configuration
const defaultDb: DatabaseSchema = {
  users: [],
  accounts: [],
  notes: [],
  activityLogs: [],
  sessions: {}
};

function readDb(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf8');
      return defaultDb;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error reading database file:', error);
    return defaultDb;
  }
}

function writeDb(data: DatabaseSchema) {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    // Write atomically in case of crashing
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    console.error('Error writing database file:', error);
  }
}

/**
 * Seeds high-quality standard sample entries so the user doesn't see an empty panel.
 */
function seedInitialDataForUser(userId: string, email: string) {
  // Temporary seed data generator removed to keep user databases clean
  const db = readDb();
  writeDb(db);
}

export const dbService = {
  //---------------------------------------------------------------------------
  // AUTHENTICATION
  //---------------------------------------------------------------------------
  
  signUp: (name: string, email: string, passwordPlain: string): { success: boolean; error?: string; user?: UserEntry } => {
    const db = readDb();
    const cleanEmail = email.toLowerCase().trim();
    
    if (db.users.some(u => u.email.toLowerCase().trim() === cleanEmail)) {
      return { success: false, error: 'Email already registered.' };
    }
    
    const id = `usr_${Math.random().toString(36).substr(2, 9)}`;
    const salt = generateSalt();
    const passwordHash = hashPassword(passwordPlain, salt);
    
    const newUser: UserEntry = {
      id,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      salt,
      createdAt: new Date().toISOString(),
      is2FAEnabled: false
    };
    
    db.users.push(newUser);
    writeDb(db);
    
    // Seed sample accounts automatically so the newly registered user gets standard accounts to start
    seedInitialDataForUser(id, cleanEmail);
    
    return { success: true, user: newUser };
  },
  
  login: (email: string, passwordPlain: string): { success: boolean; error?: string; userId?: string } => {
    const db = readDb();
    const cleanEmail = email.toLowerCase().trim();
    const user = db.users.find(u => u.email.toLowerCase().trim() === cleanEmail);
    
    if (!user) {
      return { success: false, error: 'Account not found with this email.' };
    }
    
    const currentHash = hashPassword(passwordPlain, user.salt);
    if (currentHash !== user.passwordHash) {
      return { success: false, error: 'Incorrect email or password.' };
    }
    
    return { success: true, userId: user.id };
  },

  getUserById: (userId: string): UserEntry | null => {
    const db = readDb();
    return db.users.find(u => u.id === userId) || null;
  },

  updateUserProfile: (userId: string, data: { name?: string; email?: string; is2FAEnabled?: boolean; currentPassword?: string; newPassword?: string }): { success: boolean; error?: string } => {
    const db = readDb();
    const user = db.users.find(u => u.id === userId);
    if (!user) return { success: false, error: 'User not found' };

    if (data.name !== undefined) user.name = data.name.trim();
    
    if (data.is2FAEnabled !== undefined) {
      user.is2FAEnabled = data.is2FAEnabled;
    }

    if (data.email !== undefined) {
      const cleanEmail = data.email.toLowerCase().trim();
      if (cleanEmail !== user.email) {
        if (db.users.some(u => u.id !== userId && u.email.toLowerCase().trim() === cleanEmail)) {
          return { success: false, error: 'Email already in use by another user.' };
        }
        user.email = cleanEmail;
      }
    }

    if (data.currentPassword && data.newPassword) {
      const currentHash = hashPassword(data.currentPassword, user.salt);
      if (currentHash !== user.passwordHash) {
        return { success: false, error: 'Current password verified failed.' };
      }
      const newSalt = generateSalt();
      user.salt = newSalt;
      user.passwordHash = hashPassword(data.newPassword, newSalt);
    }

    writeDb(db);
    return { success: true };
  },

  deleteUserAccount: (userId: string): boolean => {
    const db = readDb();
    const originalLength = db.users.length;
    db.users = db.users.filter(u => u.id !== userId);
    
    if (db.users.length < originalLength) {
      // Cascade delete accounts, notes, activity logs
      db.accounts = db.accounts.filter(a => a.userId !== userId);
      db.notes = db.notes.filter(n => n.userId !== userId);
      db.activityLogs = db.activityLogs.filter(l => l.userId !== userId);
      
      // Clean sessions too
      Object.keys(db.sessions).forEach(k => {
        if (db.sessions[k].userId === userId) {
          delete db.sessions[k];
        }
      });
      
      writeDb(db);
      return true;
    }
    return false;
  },

  //---------------------------------------------------------------------------
  // SESSIONS (TOKEN CACHE)
  //---------------------------------------------------------------------------
  
  createSession: (userId: string, rememberMe: boolean): string => {
    const db = readDb();
    const token = `tok_${Math.random().toString(36).substr(2, 12)}${Math.random().toString(36).substr(2, 12)}`;
    // Expiry: 7 days for rememberMe, 2 hours otherwise
    const duration = rememberMe ? 7 * 24 * 3600 * 1000 : 2 * 3600 * 1000;
    const expiresAt = Date.now() + duration;

    db.sessions[token] = { userId, expiresAt };
    writeDb(db);
    return token;
  },

  getUserIdFromSession: (token: string): string | null => {
    const db = readDb();
    const session = db.sessions[token];
    if (!session) return null;
    
    if (session.expiresAt < Date.now()) {
      delete db.sessions[token];
      writeDb(db);
      return null;
    }
    return session.userId;
  },

  deleteSession: (token: string) => {
    const db = readDb();
    if (db.sessions[token]) {
      delete db.sessions[token];
      writeDb(db);
    }
  },

  //---------------------------------------------------------------------------
  // ACCOUNTS MANAGEMENT
  //---------------------------------------------------------------------------

  getAccounts: (userId: string, includeDeleted = false): Account[] => {
    const db = readDb();
    return db.accounts.filter(a => a.userId === userId && (includeDeleted ? true : !a.isDeleted));
  },

  getAccountById: (userId: string, accountId: string): Account | null => {
    const db = readDb();
    return db.accounts.find(a => a.userId === userId && a.id === accountId) || null;
  },

  createAccount: (userId: string, accData: Partial<Account>): Account => {
    const db = readDb();
    const id = `acc_${Math.random().toString(36).substr(2, 9)}`;
    
    // Encrypt sensitive fields
    const newAccount: Account = {
      id,
      userId,
      title: accData.title || 'Untitled Account',
      platformName: accData.platformName || '',
      category: accData.category || 'Custom',
      websiteUrl: accData.websiteUrl || '',
      username: accData.username || '',
      loginEmail: accData.loginEmail || '',
      passwordEncrypted: encrypt(accData.passwordEncrypted || ''),
      
      recoveryEmailEncrypted: accData.recoveryEmailEncrypted ? encrypt(accData.recoveryEmailEncrypted) : undefined,
      recoveryPhoneEncrypted: accData.recoveryPhoneEncrypted ? encrypt(accData.recoveryPhoneEncrypted) : undefined,
      backupCodesEncrypted: accData.backupCodesEncrypted ? encrypt(accData.backupCodesEncrypted) : undefined,
      securityQuestionsEncrypted: accData.securityQuestionsEncrypted ? encrypt(accData.securityQuestionsEncrypted) : undefined,
      authenticatorSecretKeyEncrypted: accData.authenticatorSecretKeyEncrypted ? encrypt(accData.authenticatorSecretKeyEncrypted) : undefined,
      passkeysNotes: accData.passkeysNotes || '',
      
      balance: accData.balance || 0,
      currency: accData.currency || 'USD',
      earnings: accData.earnings || 0,
      withdrawnAmount: accData.withdrawnAmount || 0,
      availableAmount: accData.availableAmount || 0,
      
      creationDate: new Date().toISOString(),
      status: accData.status || 'active',
      notes: accData.notes || '',
      tags: accData.tags || [],
      
      isFavorite: accData.isFavorite || false,
      isPinned: accData.isPinned || false,
      isDeleted: false
    };

    db.accounts.push(newAccount);
    writeDb(db);
    return newAccount;
  },

  updateAccount: (userId: string, accountId: string, accData: Partial<Account>): Account | null => {
    const db = readDb();
    const acc = db.accounts.find(a => a.userId === userId && a.id === accountId);
    if (!acc) return null;

    if (accData.title !== undefined) acc.title = accData.title;
    if (accData.platformName !== undefined) acc.platformName = accData.platformName;
    if (accData.category !== undefined) acc.category = accData.category as AccountCategory;
    if (accData.websiteUrl !== undefined) acc.websiteUrl = accData.websiteUrl;
    if (accData.username !== undefined) acc.username = accData.username;
    if (accData.loginEmail !== undefined) acc.loginEmail = accData.loginEmail;
    
    // Check and encrypt updated sensitive items
    if (accData.passwordEncrypted !== undefined) acc.passwordEncrypted = encrypt(accData.passwordEncrypted);
    
    if (accData.recoveryEmailEncrypted !== undefined) {
      acc.recoveryEmailEncrypted = accData.recoveryEmailEncrypted ? encrypt(accData.recoveryEmailEncrypted) : undefined;
    }
    if (accData.recoveryPhoneEncrypted !== undefined) {
      acc.recoveryPhoneEncrypted = accData.recoveryPhoneEncrypted ? encrypt(accData.recoveryPhoneEncrypted) : undefined;
    }
    if (accData.backupCodesEncrypted !== undefined) {
      acc.backupCodesEncrypted = accData.backupCodesEncrypted ? encrypt(accData.backupCodesEncrypted) : undefined;
    }
    if (accData.securityQuestionsEncrypted !== undefined) {
      acc.securityQuestionsEncrypted = accData.securityQuestionsEncrypted ? encrypt(accData.securityQuestionsEncrypted) : undefined;
    }
    if (accData.authenticatorSecretKeyEncrypted !== undefined) {
      acc.authenticatorSecretKeyEncrypted = accData.authenticatorSecretKeyEncrypted ? encrypt(accData.authenticatorSecretKeyEncrypted) : undefined;
    }
    if (accData.passkeysNotes !== undefined) acc.passkeysNotes = accData.passkeysNotes;
    
    if (accData.balance !== undefined) acc.balance = accData.balance;
    if (accData.currency !== undefined) acc.currency = accData.currency as CurrencyCode;
    if (accData.earnings !== undefined) acc.earnings = accData.earnings;
    if (accData.withdrawnAmount !== undefined) acc.withdrawnAmount = accData.withdrawnAmount;
    if (accData.availableAmount !== undefined) acc.availableAmount = accData.availableAmount;
    
    if (accData.status !== undefined) acc.status = accData.status as 'active' | 'suspended' | 'inactive';
    if (accData.notes !== undefined) acc.notes = accData.notes;
    if (accData.tags !== undefined) acc.tags = accData.tags;
    
    if (accData.isFavorite !== undefined) acc.isFavorite = accData.isFavorite;
    if (accData.isPinned !== undefined) acc.isPinned = accData.isPinned;
    if (accData.isDeleted !== undefined) {
      acc.isDeleted = accData.isDeleted;
      if (accData.isDeleted) {
        acc.deletedAt = new Date().toISOString();
      } else {
        delete acc.deletedAt;
      }
    }
    
    writeDb(db);
    return acc;
  },

  deleteAccountPermanently: (userId: string, accountId: string): boolean => {
    const db = readDb();
    const originalLen = db.accounts.length;
    db.accounts = db.accounts.filter(a => !(a.userId === userId && a.id === accountId));
    writeDb(db);
    return db.accounts.length < originalLen;
  },

  emptyTrashBin: (userId: string): number => {
    const db = readDb();
    const prevCount = db.accounts.length;
    db.accounts = db.accounts.filter(a => !(a.userId === userId && a.isDeleted));
    
    const countAccsDeleted = prevCount - db.accounts.length;
    
    const prevNotes = db.notes.length;
    db.notes = db.notes.filter(n => !(n.userId === userId && n.isDeleted));
    const countNotesDeleted = prevNotes - db.notes.length;

    writeDb(db);
    return countAccsDeleted + countNotesDeleted;
  },

  //---------------------------------------------------------------------------
  // SECURE NOTES VAULT
  //---------------------------------------------------------------------------
  getNotes: (userId: string, includeDeleted = false): Note[] => {
    const db = readDb();
    return db.notes.filter(n => n.userId === userId && (includeDeleted ? true : !n.isDeleted));
  },

  createNote: (userId: string, noteData: Partial<Note>): Note => {
    const db = readDb();
    const id = `note_${Math.random().toString(36).substr(2, 9)}`;
    
    const newNote: Note = {
      id,
      userId,
      title: noteData.title || 'Untitled Note',
      category: noteData.category || 'General',
      contentEncrypted: encrypt(noteData.contentEncrypted || ''),
      tags: noteData.tags || [],
      isFavorite: noteData.isFavorite || false,
      isPinned: noteData.isPinned || false,
      isDeleted: false,
      creationDate: new Date().toISOString()
    };
    
    db.notes.push(newNote);
    writeDb(db);
    return newNote;
  },

  updateNote: (userId: string, noteId: string, noteData: Partial<Note>): Note | null => {
    const db = readDb();
    const note = db.notes.find(n => n.userId === userId && n.id === noteId);
    if (!note) return null;

    if (noteData.title !== undefined) note.title = noteData.title;
    if (noteData.category !== undefined) note.category = noteData.category;
    if (noteData.contentEncrypted !== undefined) note.contentEncrypted = encrypt(noteData.contentEncrypted);
    if (noteData.tags !== undefined) note.tags = noteData.tags;
    if (noteData.isFavorite !== undefined) note.isFavorite = noteData.isFavorite;
    if (noteData.isPinned !== undefined) note.isPinned = noteData.isPinned;
    if (noteData.isDeleted !== undefined) {
      note.isDeleted = noteData.isDeleted;
      if (noteData.isDeleted) {
        note.deletedAt = new Date().toISOString();
      } else {
        delete note.deletedAt;
      }
    }

    writeDb(db);
    return note;
  },

  deleteNotePermanently: (userId: string, noteId: string): boolean => {
    const db = readDb();
    const prevLen = db.notes.length;
    db.notes = db.notes.filter(n => !(n.userId === userId && n.id === noteId));
    writeDb(db);
    return db.notes.length < prevLen;
  },

  //---------------------------------------------------------------------------
  // ACTIVITY LOGS
  //---------------------------------------------------------------------------
  getLogs: (userId: string): ActivityLog[] => {
    const db = readDb();
    return db.activityLogs
      .filter(l => l.userId === userId)
      .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50); // Keep last 50
  },

  logAction: (userId: string, action: ActivityLog['action'], details: string) => {
    const db = readDb();
    const newLog: ActivityLog = {
      id: `log_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      action,
      details,
      timestamp: new Date().toISOString()
    };
    db.activityLogs.push(newLog);
    writeDb(db);
  },

  //---------------------------------------------------------------------------
  // EXPORT / BULK IMPORT VAULT
  //---------------------------------------------------------------------------
  getPlaintextVaultData: (userId: string): { accounts: any[]; notes: any[] } => {
    const db = readDb();
    const userAccounts = db.accounts.filter(a => a.userId === userId && !a.isDeleted);
    const userNotes = db.notes.filter(n => n.userId === userId && !n.isDeleted);

    // Return with plaintext, decrypted fields
    const plainAccounts = userAccounts.map(a => ({
      ...a,
      password: decrypt(a.passwordEncrypted),
      recoveryEmail: decrypt(a.recoveryEmailEncrypted || ''),
      recoveryPhone: decrypt(a.recoveryPhoneEncrypted || ''),
      backupCodes: decrypt(a.backupCodesEncrypted || ''),
      securityQuestions: a.securityQuestionsEncrypted ? JSON.parse(decrypt(a.securityQuestionsEncrypted)) : [],
      authenticatorSecretKey: decrypt(a.authenticatorSecretKeyEncrypted || ''),
    }));

    const plainNotes = userNotes.map(n => ({
      ...n,
      content: decrypt(n.contentEncrypted)
    }));

    return { accounts: plainAccounts, notes: plainNotes };
  },

  importAccountsFromRows: (userId: string, rows: any[]): number => {
    let successCount = 0;
    const db = readDb();

    for (const r of rows) {
      const id = `acc_${Math.random().toString(36).substr(2, 9)}`;
      
      const newAccount: Account = {
        id,
        userId,
        title: r.title || r.AccountTitle || r.name || 'Imported Account',
        platformName: r.platformName || r.PlatformName || r.platform || '',
        category: (r.category || r.Category || 'Custom') as AccountCategory,
        websiteUrl: r.websiteUrl || r.WebsiteURL || r.url || '',
        username: r.username || r.Username || '',
        loginEmail: r.loginEmail || r.LoginEmail || r.email || '',
        passwordEncrypted: encrypt(r.password || r.Password || r.passwordPlain || 'Imported123!'),
        
        recoveryEmailEncrypted: r.recoveryEmail || r.RecoveryEmail ? encrypt(r.recoveryEmail || r.RecoveryEmail) : undefined,
        recoveryPhoneEncrypted: r.recoveryPhone || r.RecoveryPhone ? encrypt(r.recoveryPhone || r.RecoveryPhone) : undefined,
        backupCodesEncrypted: r.backupCodes || r.BackupCodes ? encrypt(r.backupCodes || r.BackupCodes) : undefined,
        authenticatorSecretKeyEncrypted: r.authenticatorSecretKey || r.AuthenticatorSecretKey ? encrypt(r.authenticatorSecretKey || r.AuthenticatorSecretKey) : undefined,
        passkeysNotes: r.passkeysNotes || r.PasskeyNotes || '',
        
        balance: parseFloat(r.balance || r.Balance || '0') || 0,
        currency: (r.currency || r.Currency || 'USD') as CurrencyCode,
        earnings: parseFloat(r.earnings || r.Earnings || '0') || 0,
        withdrawnAmount: parseFloat(r.withdrawnAmount || r.WithdrawnAmount || '0') || 0,
        availableAmount: parseFloat(r.availableAmount || r.AvailableAmount || '0') || 0,
        
        creationDate: new Date().toISOString(),
        status: 'active',
        notes: r.notes || r.Notes || 'Imported from CSV',
        tags: r.tags ? (typeof r.tags === 'string' ? r.tags.split(',') : r.tags) : ['Imported'],
        
        isFavorite: false,
        isPinned: false,
        isDeleted: false
      };

      db.accounts.push(newAccount);
      successCount++;
    }

    if (successCount > 0) {
      writeDb(db);
    }
    return successCount;
  }
};
