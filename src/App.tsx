import React, { useState, useEffect } from 'react';
import { 
  Lock, Unlock, Shield, Key, Search, PlusCircle, Layout, FileText, 
  Activity, Settings, Trash2, LogOut, ArrowRight, Loader2, Play, CheckCircle, 
  AlertTriangle, Filter, SortAsc, HelpCircle, User, Star, Eye, EyeOff, Copy, Check, Pin
} from 'lucide-react';
import DashboardStatsCards from './components/DashboardStatsCards.js';
import PasswordGenerator from './components/PasswordGenerator.js';
import AccountDetailModal from './components/AccountDetailModal.js';
import NotesSection from './components/NotesSection.js';
import PasswordHealth from './components/PasswordHealth.js';
import TrashBinSection from './components/TrashBinSection.js';
import ProfileSettings from './components/ProfileSettings.js';
import { Account, UserProfile, DashboardStats, PasswordHealthSummary, ActivityLog, AccountCategory, CurrencyCode, SecurityQuestion } from './types.js';

export default function App() {
  // Authentication states
  const [token, setToken] = useState<string | null>(localStorage.getItem('vault_token'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoginView, setIsLoginView] = useState<boolean>(true);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  
  // Input fields for signup / login
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirm, setAuthConfirm] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [authError, setAuthError] = useState('');

  // App Layout Navigation
  const [activeTab, setActiveTab] = useState<'vault' | 'notes' | 'health' | 'trash' | 'settings'>('vault');

  // Vault data states
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [health, setHealth] = useState<PasswordHealthSummary | null>(null);
  
  // Loading indicators
  const [loadingData, setLoadingData] = useState<boolean>(false);

  // Filters & Searching
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'Date' | 'Name' | 'Category' | 'Balance'>('Date');

  // Trigger add credential drawer
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState<boolean>(false);
  const [selectedDetailAccount, setSelectedDetailAccount] = useState<Account | null>(null);

  // Password Reveal inside list (vulnerable reveals logged as audit)
  const [quickRevealedId, setQuickRevealedId] = useState<string | null>(null);
  const [quickRevealedPassword, setQuickRevealedPassword] = useState<string>('');
  const [quickRevealing, setQuickRevealing] = useState<boolean>(false);

  // New account form states
  const [newTitle, setNewTitle] = useState('');
  const [newPlatform, setNewPlatform] = useState('');
  const [newCategory, setNewCategory] = useState<AccountCategory>('Custom');
  const [newWebUrl, setNewWebUrl] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [hasExtraSecurity, setHasExtraSecurity] = useState<boolean>(false);
  
  // Extra security inputs
  const [newBackupCodes, setNewBackupCodes] = useState('');
  const [newQuestions, setNewQuestions] = useState<SecurityQuestion[]>([]);
  const [newAuthSecret, setNewAuthSecret] = useState('');
  const [newPasskeyNotes, setNewPasskeyNotes] = useState('');
  
  // Balance inputs
  const [newBalance, setNewBalance] = useState<number>(0);
  const [newCurrency, setNewCurrency] = useState<CurrencyCode>('USD');
  const [newEarnings, setNewEarnings] = useState<number>(0);
  const [newWithdrawn, setNewWithdrawn] = useState<number>(0);
  const [newAvailable, setNewAvailable] = useState<number>(0);
  
  // General notes & tags
  const [newNotes, setNewNotes] = useState('');
  const [newTagsText, setNewTagsText] = useState('');

  // Copy helpers
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 1. Session verification on launch
  useEffect(() => {
    const cachedToken = localStorage.getItem('vault_token') || sessionStorage.getItem('vault_token');
    if (cachedToken) {
      setToken(cachedToken);
      verifySession(cachedToken);
    } else {
      setLoadingAuth(false);
    }
  }, []);

  const verifySession = async (userToken: string) => {
    try {
      const resp = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      if (resp.ok) {
        const profile = await resp.json();
        setUser(profile);
      } else {
        // Clear expired session
        localStorage.removeItem('vault_token');
        sessionStorage.removeItem('vault_token');
        setToken(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAuth(false);
    }
  };

  // 2. Fetch credentials and analytics dashboard stats
  const fetchDashboardPayload = async () => {
    if (!token) return;
    setLoadingData(true);
    try {
      // 1. Fetch active accounts
      const accResp = await fetch('/api/accounts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const accData = await accResp.json();
      if (accResp.ok) {
        setAccounts(accData);
      }

      // 2. Fetch complex stats details
      const statsResp = await fetch('/api/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statsObj = await statsResp.json();
      if (statsResp.ok) {
        setStats(statsObj.stats);
        setHealth(statsObj.health);
      }

      // 3. Fetch audit logs timeline
      const logsResp = await fetch('/api/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const logsData = await logsResp.json();
      if (logsResp.ok) {
        setLogs(logsData);
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboardPayload();
    }
  }, [token]);

  // Auth execution: Signup / Signin
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoadingAuth(true);

    if (isLoginView) {
      // Login
      try {
        const resp = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail, password: authPassword, rememberMe })
        });
        const data = await resp.json();
        if (resp.ok) {
          const matchedToken = data.token;
          if (rememberMe) {
            localStorage.setItem('vault_token', matchedToken);
          } else {
            sessionStorage.setItem('vault_token', matchedToken);
          }
          setToken(matchedToken);
          setUser(data.user);
          setAuthPassword(''); // Clear password inputs
        } else {
          setAuthError(data.error || 'Authentication credential check failed.');
        }
      } catch (err) {
        setAuthError('Network communication error.');
      } finally {
        setLoadingAuth(false);
      }
    } else {
      // Registration
      if (authPassword !== authConfirm) {
        setAuthError('Passwords do not match.');
        setLoadingAuth(false);
        return;
      }
      try {
        const resp = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: authName, email: authEmail, password: authPassword })
        });
        const data = await resp.json();
        if (resp.ok) {
          localStorage.setItem('vault_token', data.token);
          setToken(data.token);
          setUser(data.user);
          // reset form
          setAuthName('');
          setAuthEmail('');
          setAuthPassword('');
          setAuthConfirm('');
        } else {
          setAuthError(data.error || 'Account creation rejected.');
        }
      } catch (err) {
        setAuthError('Connection error.');
      } finally {
        setLoadingAuth(false);
      }
    }
  };

  const handleLogOutAction = async () => {
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
    localStorage.removeItem('vault_token');
    sessionStorage.removeItem('vault_token');
    setToken(null);
    setUser(null);
    setAccounts([]);
    setLogs([]);
    setStats(null);
  };

  // Add extra question row
  const handleAddQuestionRow = () => {
    setNewQuestions([...newQuestions, { question: '', answer: '' }]);
  };

  const handleAddAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newPlatform.trim()) {
      alert('Account Title and Platform are required.');
      return;
    }

    const tagsArr = newTagsText.split(',').map(t => t.trim()).filter(t => t.length > 0);

    const postBody = {
      title: newTitle,
      platformName: newPlatform,
      category: newCategory,
      websiteUrl: newWebUrl,
      username: newUsername,
      loginEmail: newEmail,
      passwordEncrypted: newPassword,
      
      // Extended fields
      recoveryEmailEncrypted: hasExtraSecurity ? newBackupCodes : undefined,
      backupCodesEncrypted: hasExtraSecurity ? newBackupCodes : undefined,
      securityQuestionsEncrypted: hasExtraSecurity ? JSON.stringify(newQuestions) : undefined,
      authenticatorSecretKeyEncrypted: hasExtraSecurity ? newAuthSecret : undefined,
      passkeysNotes: hasExtraSecurity ? newPasskeyNotes : undefined,

      balance: newBalance,
      currency: newCurrency,
      earnings: newEarnings,
      withdrawnAmount: newWithdrawn,
      availableAmount: newAvailable,
      notes: newNotes,
      tags: tagsArr
    };

    try {
      const resp = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(postBody)
      });
      if (resp.ok) {
        setIsAddDrawerOpen(false);
        fetchDashboardPayload();
        
        // Reset form completely
        setNewTitle('');
        setNewPlatform('');
        setNewCategory('Custom');
        setNewWebUrl('');
        setNewUsername('');
        setNewEmail('');
        setNewPassword('');
        setHasExtraSecurity(false);
        setNewBackupCodes('');
        setNewQuestions([]);
        setNewAuthSecret('');
        setNewPasskeyNotes('');
        setNewBalance(0);
        setNewEarnings(0);
        setNewWithdrawn(0);
        setNewAvailable(0);
        setNewNotes('');
        setNewTagsText('');
      } else {
        const err = await resp.json();
        alert(err.error || 'Failed to save account into vault.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevealQuickPassword = async (accountId: string) => {
    if (quickRevealedId === accountId) {
      setQuickRevealedId(null);
      setQuickRevealedPassword('');
      return;
    }

    setQuickRevealing(true);
    try {
      const resp = await fetch(`/api/accounts/${accountId}/reveal`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.ok) {
        setQuickRevealedId(accountId);
        setQuickRevealedPassword(data.password);
        fetchDashboardPayload(); // reload log audit trails!
      }
    } catch (e) {
      console.error(e);
    } finally {
      setQuickRevealing(false);
    }
  };

  const handleCopyValue = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleSoftDeleteAccount = async (id: string) => {
    try {
      const resp = await fetch(`/api/accounts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        setSelectedDetailAccount(null);
        fetchDashboardPayload();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ---------------------------------------------------------------------------
  // FILTERING AND SORTING LOGIC
  // ---------------------------------------------------------------------------
  const filteredAccounts = accounts.filter(a => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      a.title.toLowerCase().includes(q) ||
      a.platformName.toLowerCase().includes(q) ||
      a.username.toLowerCase().includes(q) ||
      a.loginEmail.toLowerCase().includes(q) ||
      (a.notes && a.notes.toLowerCase().includes(q)) ||
      (a.tags && a.tags.some(t => t.toLowerCase().includes(q)));

    const matchesCategory = selectedCategory === 'All' || a.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const sortedAccounts = [...filteredAccounts].sort((a,b) => {
    if (sortBy === 'Date') {
      return new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime();
    }
    if (sortBy === 'Name') {
      return a.title.localeCompare(b.title);
    }
    if (sortBy === 'Category') {
      return a.category.localeCompare(b.category);
    }
    if (sortBy === 'Balance') {
      return b.balance - a.balance;
    }
    return 0;
  });

  // Highlight pins first globally in the view list
  const finalDisplayAccounts = [...sortedAccounts].sort((a,b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  if (loadingAuth && !token) {
    return (
      <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-red-500 mb-3" />
        <span className="font-mono text-xs">Decrypting secure local vault...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030303] text-slate-105 font-sans antialiased text-sm">
      
      {!token ? (
        /* =====================================================================
           UNAUTHENTICATED AUTH VIEW STATE (Login & Registration)
           ===================================================================== */
        <div id="unauth-container" className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
          {/* Subtle design cosmic lights */}
          <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-red-950/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-950/5 rounded-full blur-3xl pointer-events-none" />

          <div className="w-full max-w-md bg-[#0a0506]/90 backdrop-blur-xl border border-red-955/30 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center p-3 bg-red-950/20 text-red-500 rounded-2xl border border-red-900/30 mb-1 animate-pulse">
                <Shield className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-100 tracking-tight font-display">Digital Vault Pro</h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">Enterprise-level AES-256 Symmetric Encryption Personal Password & Account Manager</p>
            </div>

            {authError && (
              <div className="p-3.5 bg-red-950/20 text-red-400 border border-red-900/30 rounded-xl text-xs font-semibold leading-relaxed text-left flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
              {!isLoginView && (
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">FullName</label>
                  <input
                    type="text"
                    required
                    id="reg-name"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-black text-xs border border-red-955/45 rounded-xl px-3.5 py-3 text-slate-200 placeholder:text-neutral-700 focus:outline-none focus:border-red-655"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-sans">Email Address</label>
                <input
                  type="email"
                  required
                  id="auth-email-field"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="vault.custodian@example.com"
                  className="w-full bg-black text-xs border border-red-955/45 rounded-xl px-3.5 py-3 text-slate-200 placeholder:text-neutral-700 focus:outline-none focus:border-red-655"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Master Password</label>
                <input
                  type="password"
                  required
                  id="auth-pwd-field"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full bg-black text-xs border border-red-955/45 rounded-xl px-3.5 py-3 text-slate-200 placeholder:text-neutral-700 focus:outline-none focus:border-red-655 font-mono"
                />
              </div>

              {!isLoginView && (
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">Confirm Master Password</label>
                  <input
                    type="password"
                    required
                    id="reg-pwd-confirm"
                    value={authConfirm}
                    onChange={(e) => setAuthConfirm(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full bg-black text-xs border border-red-955/45 rounded-xl px-3.5 py-3 text-slate-200 placeholder:text-neutral-700 focus:outline-none focus:border-red-655 font-mono"
                  />
                </div>
              )}

              {isLoginView && (
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={() => setRememberMe(!rememberMe)}
                      className="w-4 h-4 border-red-955/65 bg-[#000000] text-red-500 rounded focus:ring-0 cursor-pointer accent-red-600"
                    />
                    <span>Remember this machine</span>
                  </label>
                </div>
              )}

              <button
                id="btn-auth-submit"
                type="submit"
                disabled={loadingAuth}
                className="w-full mt-3 py-3 bg-red-650 hover:bg-red-550 border border-red-900/20 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-950/20"
              >
                {loadingAuth ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{isLoginView ? 'Unlock Digital Vault' : 'Initialize Personal Workspace'}</span>
              </button>
            </form>

            <div className="border-t border-red-955/20 pt-4 text-center">
              <button
                id="toggle-auth-view"
                onClick={() => {
                  setIsLoginView(!isLoginView);
                  setAuthError('');
                }}
                className="text-xs text-red-500 hover:text-red-400 font-extrabold cursor-pointer"
              >
                {isLoginView ? 'New to Digital Vault? Setup account workspace' : 'Back to vault security entry'}
              </button>
            </div>
            
            <p className="text-[10px] text-slate-500 text-center font-mono select-none">
              Client session uses HTTPS Transport Layer Security
            </p>
          </div>
        </div>
      ) : (
        /* =====================================================================
           AUTHENTICATED MASTER DASHBOARD VIEW
           ===================================================================== */
        <div id="dashboard-layout" className="min-h-screen flex flex-col md:flex-row bg-[#030303]">
          
          {/* Dashboard Left Sidebar */}
          <aside className="w-full md:w-64 bg-[#060606] border-r border-red-955/20 p-5 flex flex-col justify-between shrink-0">
            <div className="space-y-6">
              {/* Logo branding line */}
              <div className="flex items-center gap-2.5 pb-4 border-b border-red-955/20">
                <div className="p-1.5 bg-red-955/20 text-red-500 rounded-lg border border-red-900/35">
                  <Shield className="w-5 h-5 animate-pulse" />
                </div>
                <div className="text-left font-sans">
                  <h1 className="text-sm font-black text-slate-100 tracking-tight leading-none font-display">Digital Vault Pro</h1>
                  <span className="text-[9px] text-red-500 font-bold block uppercase mt-0.5 tracking-wider font-mono">Enterprise Security</span>
                </div>
              </div>

              {/* Custodian short profile info */}
              {user && (
                <div className="p-3 bg-black border border-red-955/35 rounded-xl flex items-center gap-2.5 text-left">
                  <div className="w-9 h-9 rounded-full bg-red-955/25 border border-red-900/25 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="ellipsis max-w-sm">
                    <strong className="text-xs text-slate-200 block truncate">{user.name}</strong>
                    <span className="text-[9px] text-slate-500 font-mono truncate block">{user.email}</span>
                  </div>
                </div>
              )}

              {/* Main Sidebar Links */}
              <nav className="space-y-1.5 text-left" id="navigation-panels">
                <button
                  onClick={() => setActiveTab('vault')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'vault' ? 'bg-red-955/20 border border-red-900/30 text-red-500 font-bold' : 'text-slate-400 hover:text-red-400 hover:bg-neutral-900/40 border border-transparent'
                  }`}
                >
                  <Key className="w-4 h-4" />
                  <span>Passwords &amp; Accounts</span>
                </button>

                <button
                  onClick={() => setActiveTab('notes')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'notes' ? 'bg-red-955/20 border border-red-900/30 text-red-500 font-bold' : 'text-slate-400 hover:text-red-400 hover:bg-neutral-900/40 border border-transparent'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Secure Notes Vault</span>
                </button>

                <button
                  onClick={() => setActiveTab('health')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'health' ? 'bg-red-955/20 border border-red-900/30 text-red-500 font-bold' : 'text-slate-400 hover:text-red-400 hover:bg-neutral-900/40 border border-transparent'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span>Security Diagnostics</span>
                </button>

                <button
                  onClick={() => setActiveTab('trash')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'trash' ? 'bg-red-955/20 border border-red-900/30 text-red-500 font-bold' : 'text-slate-400 hover:text-red-400 hover:bg-neutral-900/40 border border-transparent'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Secure Trash Bin</span>
                </button>

                <button
                  onClick={() => setActiveTab('settings')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'settings' ? 'bg-red-955/20 border border-red-900/30 text-red-500 font-bold' : 'text-slate-400 hover:text-red-400 hover:bg-neutral-900/40 border border-transparent'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>Vault Controls</span>
                </button>
              </nav>
            </div>

            {/* Bottom logout toggle */}
            <div className="pt-4 border-t border-red-955/20">
              <button
                id="btn-sidebar-logout"
                onClick={handleLogOutAction}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-neutral-950 hover:bg-neutral-900 border border-red-955/35 text-slate-400 hover:text-red-405 text-xs font-extrabold rounded-xl transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Lock Vault Storage</span>
              </button>
            </div>
          </aside>

          {/* Primary View content panel scrolling */}
          <main className="flex-1 p-5 md:p-8 overflow-y-auto max-h-screen">
            
            {activeTab === 'vault' && (
              /* ===============================================================
                 DECRYPTED REPOS/CREDENTIALS VIEW TAB
                 =============================================================== */
              <div className="space-y-6" id="dashboard-passwords-view">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="text-left font-sans">
                    <h2 className="text-lg font-black text-slate-100 font-sans">Digital Credentials Vault</h2>
                    <p className="text-[10px] text-slate-500 font-mono">Real-time localized search with multi-currency balance auditing</p>
                  </div>

                  <button
                    id="btn-add-credential"
                    onClick={() => setIsAddDrawerOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-red-650 hover:bg-red-550 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/10 cursor-pointer transition-all"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Save New Account
                  </button>
                </div>
 
                 {/* Dashboard statistics panel */}
                 <DashboardStatsCards 
                   stats={stats} 
                   health={health} 
                   loading={loadingData} 
                   onNavigateToCategory={(cat) => setSelectedCategory(cat)}
                   onNavigateToHealth={() => setActiveTab('health')}
                 />
 
                 {/* Search query options & filters panel */}
                 <div className="bg-[#0a0a0a]/85 border border-red-955/20 rounded-3xl p-5 space-y-3 shadow-sm">
                   <div className="flex flex-col md:flex-row gap-3">
                     {/* Instant Search input */}
                     <div className="relative flex-1">
                       <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500/80 pointer-events-none" />
                       <input
                         id="search-accounts-input"
                         type="text"
                         placeholder="Search custom keys by platform name, email, credentials title, notes or description tags..."
                         value={searchQuery}
                         onChange={(e) => setSearchQuery(e.target.value)}
                         className="w-full bg-[#050505] border border-red-955/40 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-205 placeholder:text-neutral-700 focus:outline-none focus:border-red-655 font-sans"
                       />
                     </div>
 
                     {/* Sorting criteria picker */}
                     <div className="flex gap-2">
                       <div className="relative flex items-center bg-[#050505] border border-red-955/40 rounded-2xl px-3.5 text-xs text-slate-400 shrink-0 font-sans">
                         <SortAsc className="w-3.5 h-3.5 mr-1.5 text-red-500/80" />
                         <span className="mr-1.5">Sort:</span>
                         <select
                           value={sortBy}
                           onChange={(e) => setSortBy(e.target.value as any)}
                           className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-semibold py-1.5"
                         >
                           <option value="Date" className="bg-[#050505]">Date Added</option>
                           <option value="Name" className="bg-[#050505]">Platform name</option>
                           <option value="Category" className="bg-[#050505]">Category</option>
                           <option value="Balance" className="bg-[#050505]">Asset Balance</option>
                         </select>
                       </div>
                     </div>
                   </div>
 
                   {/* Horizontal Category Pill Filter lists */}
                   <div className="flex flex-wrap gap-2 pt-2 border-t border-red-955/20 pb-0.5">
                     {['All', 'Gmail', 'Social Media', 'Banking', 'Crypto', 'Gaming', 'Business', 'Custom'].map(cat => (
                       <button
                         key={cat}
                         onClick={() => setSelectedCategory(cat)}
                         className={`px-3.5 py-1.5 rounded-xl border text-[11px] font-sans font-semibold transition-all cursor-pointer ${
                           selectedCategory === cat 
                             ? 'bg-red-955/20 border border-red-900/30 text-red-400' 
                             : 'bg-black border-red-955/35 text-slate-400 hover:text-red-400 hover:bg-[#0a0506]/35'
                         }`}
                       >
                         {cat === 'All' ? 'All categories' : cat}
                       </button>
                     ))}
                   </div>
                 </div>
 
                 {/* Main Credentials Table list grid */}
                 <div className="space-y-3" id="vault-display-grid">
                   {loadingData && accounts.length === 0 ? (
                     <div className="flex justify-center py-20">
                       <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                     </div>
                   ) : finalDisplayAccounts.length === 0 ? (
                     <div className="text-center py-16 bg-[#0a0a0a] border border-red-955/20 rounded-3xl shadow-sm">
                       <Key className="w-10 h-10 text-red-905/40 mx-auto mb-2 animate-bounce" />
                       <h4 className="text-xs font-bold text-slate-200 font-display">No Credentials Found</h4>
                       <p className="text-[10.5px] text-slate-500 max-w-sm mx-auto mt-0.5 font-sans leading-relaxed">We audited found no saved items matching search tags. Select "Save New Account" above to save passwords.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {finalDisplayAccounts.map(a => (
                        <div
                          key={a.id}
                          className={`bg-[#0a0a0a]/80 border hover:border-red-955/60 rounded-3xl p-5 text-left flex flex-col justify-between transition-all group shadow-sm ${
                            a.isPinned ? 'border-red-500/30 bg-gradient-to-br from-red-950/15 to-transparent shadow-[0_0_15px_rgba(239,68,68,0.02)]' : 'border-red-955/25'
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex justify-between items-start">
                              <span className="text-[9px] text-red-550 font-semibold font-mono uppercase tracking-wider">
                                {a.category}
                              </span>
                              <div className="flex gap-2 shrink-0">
                                {a.isPinned && <Pin className="w-3 h-3 text-red-500 fill-red-500" title="Pinned Account" />}
                                {a.isFavorite && <Star className="w-3 h-3 text-amber-500 fill-amber-500" title="Favorite Account" />}
                              </div>
                            </div>

                            <div 
                              onClick={() => setSelectedDetailAccount(a)}
                              className="cursor-pointer space-y-0.5 select-none"
                            >
                              <h4 className="text-xs font-bold text-slate-100 group-hover:text-red-400 transition-colors truncate font-display">
                                {a.title}
                              </h4>
                              <p className="text-[10px] text-slate-500 truncate font-mono">
                               Platform: {a.platformName || 'N/A'}
                              </p>
                            </div>

                            <hr className="border-red-955/20" />

                            {/* Short Username and decrypt Password revealing triggers */}
                            <div className="space-y-2">
                              {a.username && (
                                <div className="flex items-center justify-between text-[11px] bg-black px-2.5 py-1.5 rounded-xl border border-red-955/35 font-mono">
                                  <span className="text-slate-400 truncate max-w-xs">{a.username}</span>
                                  <button
                                    onClick={() => handleCopyValue(a.username, `${a.id}_usr`)}
                                    className="p-1 text-slate-500 hover:text-[#94A3B8] cursor-pointer"
                                  >
                                    {copiedId === `${a.id}_usr` ? <Check className="w-3 h-3 text-red-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              )}

                              <div className="flex items-center justify-between text-[11px] bg-black px-2.5 py-1.5 rounded-xl border border-red-955/35 font-mono">
                                <span className={`font-semibold ${quickRevealedId === a.id ? 'text-red-400' : 'text-slate-505'}`}>
                                  {quickRevealedId === a.id ? quickRevealedPassword : '••••••••••••••••'}
                                </span>
                                
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => handleRevealQuickPassword(a.id)}
                                    disabled={quickRevealing}
                                    className="p-1 text-slate-500 hover:text-slate-350 cursor-pointer"
                                    title="Reveal credentials"
                                  >
                                    {quickRevealedId === a.id ? <EyeOff className="w-3 h-3 text-red-400" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                  {quickRevealedId === a.id && (
                                    <button
                                      onClick={() => handleCopyValue(quickRevealedPassword, `${a.id}_pwd`)}
                                      className="p-1 text-slate-500 hover:text-slate-300 cursor-pointer"
                                    >
                                      {copiedId === `${a.id}_pwd` ? <Check className="w-3 h-3 text-red-400" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Cash Funds tracking displays */}
                          <div className="flex items-center justify-between pt-3.5 mt-3 border-t border-red-955/20 text-left">
                            <div className="space-y-0.5">
                              <span className="text-[8px] text-slate-500 font-mono block uppercase">Vault Ledger</span>
                              <span className="font-mono text-xs text-red-400 font-semibold block">
                                {a.balance} {a.currency}
                              </span>
                            </div>

                            <button
                              onClick={() => setSelectedDetailAccount(a)}
                              className="text-[10px] px-3 py-1.5 bg-black border border-red-955/45 hover:bg-red-950/15 text-slate-205 hover:text-red-400 font-semibold rounded-xl cursor-pointer transition-colors"
                            >
                              Open Details
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Audit log list on front panel */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-red-955/20">
                  <div className="md:col-span-2 bg-[#0a0a0a]/85 border border-red-955/20 rounded-3xl p-6 text-left font-sans shadow-sm">
                    <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-red-955/20 pb-2.5 font-display">
                      <Activity className="w-4 h-4 text-red-500 animate-pulse" />
                      Dynamic Security Audit Timeline (Local Logs)
                    </h4>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {logs.length === 0 ? (
                        <p className="text-xs text-slate-500 italic text-center py-6">No logs recorded on this account.</p>
                      ) : (
                        logs.map(l => (
                          <div key={l.id} className="flex gap-3 text-xs border-b border-red-955/15 pb-2 last:border-0 last:pb-0 items-start">
                            <span className="text-[9px] font-mono text-slate-500 shrink-0 mt-0.5">
                              {new Date(l.timestamp).toLocaleTimeString()}
                            </span>
                            <div className="flex-1 space-y-0.5 leading-relaxed">
                              <span className="font-semibold text-slate-205 mr-1.5 flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[8px] px-1.5 py-0.2 rounded font-mono font-bold border ${
                                  l.action === 'VIEW_PASSWORD' ? 'bg-red-950/20 text-red-400 border-red-900/20' :
                                  l.action === 'LOGIN' ? 'bg-red-950/10 text-red-450 border border-red-900/15' :
                                  'bg-neutral-900 text-slate-450 border-neutral-800'
                                }`}>
                                  {l.action}
                                </span>
                                <span className="text-slate-350 select-all font-mono text-[10.5px]">{l.details}</span>
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Sidebar Password Generator shortcut */}
                  <div className="md:col-span-1">
                    <PasswordGenerator />
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'notes' && (
              <NotesSection token={token} onLogAction={fetchDashboardPayload} />
            )}

            {activeTab === 'health' && (
              <PasswordHealth 
                token={token} 
                accounts={accounts} 
                onSelectAccount={(acc) => setSelectedDetailAccount(acc)} 
              />
            )}

            {activeTab === 'trash' && (
              <TrashBinSection token={token} onRefreshStats={fetchDashboardPayload} />
            )}

            {activeTab === 'settings' && (
              <ProfileSettings 
                user={user} 
                token={token} 
                onUpdateUser={(updated) => setUser(updated)} 
                onLogout={handleLogOutAction} 
              />
            )}

          </main>

          {/* ===================================================================
              CENTERED DETAILED OVERLAY MODAL
              =================================================================== */}
          <AccountDetailModal
            account={selectedDetailAccount}
            isOpen={!!selectedDetailAccount}
            onClose={() => setSelectedDetailAccount(null)}
            onUpdate={(updated) => {
              // Sync updated account directly into locally stored array
              setAccounts(accounts.map(a => a.id === updated.id ? updated : a));
              setSelectedDetailAccount(updated);
              fetchDashboardPayload(); // Recalculate stats & health counts!
            }}
            onDelete={handleSoftDeleteAccount}
            token={token}
          />

          {/* ===================================================================
              DRAWER COLLAPSIBLE SLIDE-DOWN: "SAVE NEW ACCOUNT" FORM
              =================================================================== */}
          {isAddDrawerOpen && (
            <div id="add-drawer-wrapper" className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm flex justify-center items-center p-4">
              <div className="w-full max-w-xl bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl">
                <div className="p-5 border-b border-slate-850 flex items-center justify-between bg-slate-900/60 sticky top-0">
                  <div className="flex items-center gap-2 text-left">
                    <PlusCircle className="w-5 h-5 text-red-500" />
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-100 font-sans">Save New Account Credentials</h4>
                      <p className="text-[10px] text-slate-500 font-mono leading-none">AES-256 Symmetric Hardware Acceleration Encrypted</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsAddDrawerOpen(false)}
                    className="p-1 px-2.5 bg-neutral-950 hover:bg-neutral-900 border border-red-955/35 rounded-lg text-xs font-bold text-slate-400 cursor-pointer"
                  >
                    Discard
                  </button>
                </div>

                <form onSubmit={handleAddAccountSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                  {/* Basic credentials segments */}
                  <div className="space-y-4">
                    <h5 className="text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest text-left">Basic Information</h5>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1 text-left">
                        <label className="text-[10px] text-slate-400">Account Showcase Name *</label>
                        <input
                          type="text"
                          required
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="My Personal Facebook"
                          className="w-full bg-black border border-red-955/35 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-655 text-slate-100"
                        />
                      </div>
                      <div className="space-y-1 text-left">
                        <label className="text-[10px] text-slate-400">Platform Company *</label>
                        <input
                          type="text"
                          required
                          value={newPlatform}
                          onChange={(e) => setNewPlatform(e.target.value)}
                          placeholder="Meta / Facebook"
                          className="w-full bg-black border border-red-955/35 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-655 text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1 text-left">
                        <label className="text-[10px] text-slate-400 font-sans">Category Category *</label>
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value as AccountCategory)}
                          className="w-full bg-black border border-red-955/35 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-655 text-slate-105 cursor-pointer text-slate-200"
                        >
                          <option value="Gmail" className="bg-black text-slate-200">Gmail</option>
                          <option value="Social Media" className="bg-black text-slate-200">Social Media</option>
                          <option value="Banking" className="bg-black text-slate-200">Banking</option>
                          <option value="Crypto" className="bg-black text-slate-200">Crypto</option>
                          <option value="Gaming" className="bg-black text-slate-200">Gaming</option>
                          <option value="Business" className="bg-black text-slate-200">Business</option>
                          <option value="Custom" className="bg-black text-slate-200">Custom</option>
                        </select>
                      </div>
                      <div className="space-y-1 text-left">
                        <label className="text-[10px] text-slate-400">Website Address</label>
                        <input
                          type="text"
                          value={newWebUrl}
                          onChange={(e) => setNewWebUrl(e.target.value)}
                          placeholder="https://facebook.com"
                          className="w-full bg-black border border-red-955/35 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-655 text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1 text-left">
                        <label className="text-[10px] text-slate-400">Username / ID</label>
                        <input
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="john_doe_99"
                          className="w-full bg-black border border-red-955/35 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-red-655 text-slate-100"
                        />
                      </div>
                      <div className="space-y-1 text-left">
                        <label className="text-[10px] text-slate-400">Login email</label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="john@gmail.com"
                          className="w-full bg-black border border-red-955/35 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-red-655 text-slate-100"
                        />
                      </div>
                      <div className="space-y-1 text-left">
                        <label className="text-[10px] text-slate-400 font-bold text-slate-300">Password</label>
                        <input
                          type="text"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Auto generated or manual"
                          className="w-full bg-black border border-red-955/35 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-red-655 text-red-450 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-red-955/20" />

                  {/* Cash fund ledger segments */}
                  <div className="space-y-4">
                    <h5 className="text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest text-left">Financial Ledger Indicators</h5>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1 text-left">
                        <label className="text-[9px] text-slate-450 font-mono">My Balance</label>
                        <input
                          type="number"
                          value={newBalance}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setNewBalance(val);
                            setNewAvailable(val); // default match available
                          }}
                          className="w-full bg-black border border-red-955/35 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-red-655 text-slate-100 font-mono"
                        />
                      </div>
                      <div className="space-y-1 text-left">
                        <label className="text-[9px] text-slate-450 font-mono">Currency</label>
                        <select
                          value={newCurrency}
                          onChange={(e) => setNewCurrency(e.target.value as CurrencyCode)}
                          className="w-full bg-black border border-red-955/35 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-red-655 text-slate-105 cursor-pointer text-slate-205"
                        >
                          <option value="USD" className="bg-black text-slate-200">USD ($)</option>
                          <option value="EUR" className="bg-black text-slate-200">EUR (€)</option>
                          <option value="GBP" className="bg-black text-slate-200">GBP (£)</option>
                          <option value="BDT" className="bg-black text-slate-200">BDT (৳)</option>
                          <option value="INR" className="bg-black text-slate-200">INR (₹)</option>
                          <option value="BTC" className="bg-black text-slate-200">BTC (₿)</option>
                          <option value="ETH" className="bg-black text-slate-200">ETH (Ξ)</option>
                        </select>
                      </div>
                      <div className="space-y-1 text-left">
                        <label className="text-[9px] text-slate-450 font-mono">Earnings</label>
                        <input
                          type="number"
                          value={newEarnings}
                          onChange={(e) => setNewEarnings(parseFloat(e.target.value) || 0)}
                          className="w-full bg-black border border-red-955/35 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-red-655 text-slate-100 font-mono"
                        />
                      </div>
                      <div className="space-y-1 text-left">
                        <label className="text-[9px] text-slate-450 font-mono">Withdrawn</label>
                        <input
                          type="number"
                          value={newWithdrawn}
                          onChange={(e) => setNewWithdrawn(parseFloat(e.target.value) || 0)}
                          className="w-full bg-black border border-red-955/35 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-red-655 text-slate-100 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-red-955/20" />

                  {/* Optional advanced security checklist */}
                  <div className="space-y-3 p-4 bg-black rounded-2xl border border-red-955/35 shadow-[0_0_12px_rgba(239,68,68,0.01)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300 font-bold block">Optional Advanced MFA Secrets</span>
                      <label className="inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={hasExtraSecurity}
                          onChange={() => setHasExtraSecurity(!hasExtraSecurity)}
                          className="sr-only peer"
                        />
                        <div className="relative w-9 h-5 bg-neutral-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-400 after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-650 peer-checked:after:bg-white" />
                      </label>
                    </div>

                    {hasExtraSecurity && (
                      <div className="space-y-3 pt-3 border-t border-red-955/20 animate-fade-in text-left">
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-400">Backup Recovery Codes</label>
                            <input
                              type="text"
                              value={newBackupCodes}
                              onChange={(e) => setNewBackupCodes(e.target.value)}
                              placeholder="1234-5678, 5543-9821..."
                              className="w-full bg-black border border-red-955/35 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-red-655 text-slate-100 font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-400">TOTP Secret Key (2FA authenticator)</label>
                            <input
                              type="text"
                              value={newAuthSecret}
                              onChange={(e) => setNewAuthSecret(e.target.value)}
                              placeholder="e.g. JBWS Y3DP EHPK"
                              className="w-full bg-black border border-red-955/35 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-red-655 text-slate-100 font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400">Passkeys Presence Notes</label>
                          <input
                            type="text"
                            value={newPasskeyNotes}
                            onChange={(e) => setNewPasskeyNotes(e.target.value)}
                            placeholder="Stored in personal Apple Keyring, Chrome, etc."
                            className="w-full bg-black border border-red-955/35 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-red-655 text-slate-100"
                          />
                        </div>

                        {/* Direct dynamic Q/A challenges block */}
                        <div className="space-y-2 pt-1">
                           <div className="flex justify-between items-center">
                             <span className="text-[9px] text-slate-400 font-semibold">Security Questions Challenges ({newQuestions.length})</span>
                             <button
                               type="button"
                               onClick={handleAddQuestionRow}
                               className="text-[9px] text-red-500 hover:text-red-400 font-bold cursor-pointer transition-colors"
                             >
                               + Add Question Card
                             </button>
                           </div>

                           <div className="space-y-2">
                             {newQuestions.map((q, idx) => (
                               <div key={idx} className="flex gap-2 bg-black p-2.5 rounded border border-red-955/35 text-xs">
                                 <input
                                   placeholder="Question"
                                   value={q.question}
                                   onChange={(e) => {
                                     const updated = [...newQuestions];
                                     updated[idx].question = e.target.value;
                                     setNewQuestions(updated);
                                   }}
                                   className="flex-1 bg-black border border-red-955/20 px-2 py-1 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-red-655"
                                 />
                                 <input
                                   placeholder="Answer"
                                   value={q.answer}
                                   onChange={(e) => {
                                     const updated = [...newQuestions];
                                     updated[idx].answer = e.target.value;
                                     setNewQuestions(updated);
                                   }}
                                   className="flex-1 bg-black border border-red-955/20 px-2 py-1 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-red-655"
                                 />
                               </div>
                             ))}
                           </div>
                         </div>

                       </div>
                     )}
                   </div>

                   {/* Description comments metadata */}
                   <div className="space-y-1 text-left">
                     <label className="text-[10px] text-slate-400">Private Tags (Comma-separated)</label>
                     <input
                       type="text"
                       value={newTagsText}
                       onChange={(e) => setNewTagsText(e.target.value)}
                       placeholder="e.g. Essential, Work, SaaS"
                       className="w-full bg-black border border-red-955/35 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-655 text-slate-100"
                     />
                   </div>

                   <div className="space-y-1 text-left">
                     <label className="text-[10px] text-slate-400 font-sans">Comments &amp; Private Notes</label>
                     <textarea
                       value={newNotes}
                       onChange={(e) => setNewNotes(e.target.value)}
                       placeholder="Insert additional descriptions..."
                       className="w-full h-18 bg-black border border-red-955/35 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-655 text-slate-100"
                     />
                   </div>

                   <button
                     id="btn-trigger-add-save"
                     type="submit"
                     className="w-full py-3 bg-red-650 hover:bg-red-550 font-bold active:scale-[0.98] text-white text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                   >
                     Encrypt and Save Credentials File
                   </button>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
