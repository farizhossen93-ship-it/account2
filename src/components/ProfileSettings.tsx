import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Shield, Download, Upload, Trash2, Key, Loader2, Check, AlertTriangle, FileText,
  Database, CloudLightning, ShieldAlert, RefreshCw
} from 'lucide-react';
import { UserProfile } from '../types.js';
import { 
  getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig,
  uploadVaultToSupabase, listSupabaseVaultBackups, downloadVaultFromSupabase
} from '../lib/supabase.js';
import { 
  initGoogleAuth, googleSignIn, googleLogout,
  uploadVaultToGoogleDrive, listGoogleDriveVaultBackups, downloadVaultFromGoogleDrive
} from '../lib/googleDrive.js';

interface ProfileProps {
  user: UserProfile | null;
  token: string | null;
  onUpdateUser: (user: UserProfile) => void;
  onLogout: () => void;
}

export default function ProfileSettings({ user, token, onUpdateUser, onLogout }: ProfileProps) {
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [is2FA, setIs2FA] = useState(user?.is2FAEnabled || false);

  // Password reset states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Supabase states
  const [supabaseUrl, setSupabaseUrl] = useState(localStorage.getItem('supabase_url') || '');
  const [supabaseKey, setSupabaseKey] = useState(localStorage.getItem('supabase_key') || '');
  const [supabaseBackups, setSupabaseBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);

  // Google Drive states
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleBackups, setGoogleBackups] = useState<any[]>([]);
  const [loadingGoogleBackups, setLoadingGoogleBackups] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);

  // Status logs
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const { url, key } = getSupabaseConfig();
    if (url && key) {
      loadSupabaseBackups();
    }
  }, []);

  useEffect(() => {
    // Listen for Google Auth state changes
    const unsubscribe = initGoogleAuth(
      (u, gToken) => {
        setGoogleUser(u);
        setGoogleToken(gToken);
        // Automatically load backups
        setLoadingGoogleBackups(true);
        listGoogleDriveVaultBackups()
          .then(files => setGoogleBackups(files))
          .catch(err => console.error(err))
          .finally(() => setLoadingGoogleBackups(false));
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setGoogleBackups([]);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadGoogleDriveBackups = async () => {
    setLoadingGoogleBackups(true);
    try {
      const files = await listGoogleDriveVaultBackups();
      setGoogleBackups(files);
    } catch (err: any) {
      console.error('Failed to load Google Drive files:', err);
    } finally {
      setLoadingGoogleBackups(false);
    }
  };

  const handleConnectGoogleDrive = async () => {
    try {
      setSuccessMsg('');
      setErrorMsg('');
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        setSuccessMsg('Successfully connected to Google Drive Backup Storage!');
        setLoadingGoogleBackups(true);
        const files = await listGoogleDriveVaultBackups();
        setGoogleBackups(files);
        setLoadingGoogleBackups(false);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Google Cloud Authorization failed: ${err.message || err}`);
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    try {
      await googleLogout();
      setGoogleUser(null);
      setGoogleToken(null);
      setGoogleBackups([]);
      setSuccessMsg('Google Drive backup session disconnected.');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleBackupToGoogleDrive = async () => {
    if (!googleUser || !googleToken) {
      setErrorMsg('Please connect your Google Drive account first.');
      return;
    }
    setSyncingGoogle(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      // 1. Fetch JSON payload from local API
      const resp = await fetch('/api/export/vault?format=json', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!resp.ok) throw new Error('Unauthenticated to download local vaults.');
      const vaultData = await resp.json();

      // 2. Upload to Google Drive
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `vault_backup_${timestamp}.json`;
      
      await uploadVaultToGoogleDrive(filename, vaultData);
      setSuccessMsg(`Vault backed up successfully to your Google Drive in private application zone! Saved as [${filename}].`);
      loadGoogleDriveBackups();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Google Drive Cloud Sync failed: ${err.message}`);
    } finally {
      setSyncingGoogle(false);
    }
  };

  const handleRestoreFromGoogleDrive = async (fileId: string, filename: string) => {
    if (!confirm(`Are you sure you want to restore the entire vault state from Google Drive Cloud file: ${filename}?\n\nThis will load and synchronize all credentials into this active partition.`)) {
      return;
    }
    setImporting(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const restoredData = await downloadVaultFromGoogleDrive(fileId);
      if (!restoredData || !restoredData.accounts) {
        throw new Error('Google Drive file schema mismatch or empty.');
      }

      // Restores elements bulk to Node backend
      const resp = await fetch('/api/import/vault', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rows: restoredData.accounts })
      });
      const rData = await resp.json();
      
      if (resp.ok) {
        setSuccessMsg(`Restored ${rData.count} credentials from Google Drive! Rebooting...`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setErrorMsg(rData.error || 'Failed to commit credentials.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Google Drive restore execution failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const loadSupabaseBackups = async () => {
    setLoadingBackups(true);
    try {
      const files = await listSupabaseVaultBackups();
      setSupabaseBackups(files);
    } catch (err: any) {
      console.error('Failed to load Supabase files:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const resp = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: profileName,
          email: profileEmail,
          is2FAEnabled: is2FA
        })
      });
      const data = await resp.json();
      if (resp.ok) {
        onUpdateUser(data.user);
        setSuccessMsg('Profile security credentials updated successfully!');
      } else {
        setErrorMsg(data.error || 'Failed to update profile.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error updating profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('New password and confirm password do not match!');
      return;
    }
    if (newPassword.length < 6) {
      alert('New password must be at least 6 characters long.');
      return;
    }

    setPasswordSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const resp = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      const data = await resp.json();
      if (resp.ok) {
        setSuccessMsg('Master Password rotated successfully! Write this down securely.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setErrorMsg(data.error || 'Password update execution failed.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!confirm('CRITICAL ACTION REQUIRED!\n\nThis will completely erase your personal digital credentials. All passwords, balance lists, note cards, and logs will be permanently deleted from this machine.\n\nAre you absolutely sure you want to delete your profile?')) {
      return;
    }
    if (!confirm('Please confirm one more time. Are you absolutely certain?')) return;

    try {
      const resp = await fetch('/api/auth/profile', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        alert('All digital vault data erased. Logging out.');
        onLogout();
      } else {
        alert('Credentials mismatch. Couldn’t delete profile.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportVault = (format: 'json' | 'csv') => {
    const url = `/api/export/vault?format=${format}`;
    
    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(resp => {
      if (!resp.ok) throw new Error('Unauthenticated download.');
      return format === 'json' ? resp.json() : resp.text();
    })
    .then(data => {
      const content = format === 'json' ? JSON.stringify(data, null, 2) : data;
      const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const dlUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `digital_vault_export_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(dlUrl);
      document.body.removeChild(a);
      setSuccessMsg(`Vault accounts exported successfully as ${format.toUpperCase()}!`);
    })
    .catch(err => {
      console.error(err);
      setErrorMsg('Failed to download vault backup file.');
    });
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setSuccessMsg('');
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) {
          throw new Error('CSV is empty or missing headers');
        }

        const headers = lines[0].replace(/"/g, '').split(',');
        const parsedRows = [];

        for (let i = 1; i < lines.length; i++) {
          const rawFields = [];
          let currentField = '';
          let inQuotes = false;
          
          const line = lines[i];
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              rawFields.push(currentField);
              currentField = '';
            } else {
              currentField += char;
            }
          }
          rawFields.push(currentField);

          const rowObj: any = {};
          headers.forEach((h, idx) => {
            rowObj[h] = rawFields[idx] || '';
          });

          rowObj.title = rowObj.title || rowObj.AccountTitle;
          rowObj.platformName = rowObj.platformName || rowObj.PlatformName;
          rowObj.category = rowObj.category || rowObj.Category;
          rowObj.password = rowObj.password || rowObj.Password;

          parsedRows.push(rowObj);
        }

        const resp = await fetch('/api/import/vault', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ rows: parsedRows })
        });
        const rData = await resp.json();
        
        if (resp.ok) {
          setSuccessMsg(`Imported ${rData.count} accounts into your secure Digital Vault! Refreshing...`);
          setTimeout(() => window.location.reload(), 1500);
        } else {
          setErrorMsg(rData.error || 'Failed to parse datasets.');
        }

      } catch (err: any) {
        console.error(err);
        setErrorMsg(`Failed to import file. ${err.message}`);
      } finally {
        setImporting(false);
        if (e.target) e.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  // Supabase Sync functions
  const handleSaveSupabaseKeys = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl || !supabaseKey) {
      setErrorMsg('Please supply a valid Supabase Project URL & API Key.');
      return;
    }
    saveSupabaseConfig(supabaseUrl, supabaseKey);
    setSuccessMsg('Supabase API storage configuration connected successfully!');
    loadSupabaseBackups();
  };

  const handleResetSupabaseKeys = () => {
    clearSupabaseConfig();
    setSupabaseUrl('');
    setSupabaseKey('');
    setSupabaseBackups([]);
    setSuccessMsg('Supabase credentials cleared successfully.');
  };

  const handleBackupToSupabaseCloud = async () => {
    if (!supabaseUrl || !supabaseKey) {
      setErrorMsg('Please configure your Supabase context first.');
      return;
    }
    setSyncingCloud(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      // 1. Fetch JSON payload from local API
      const resp = await fetch('/api/export/vault?format=json', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!resp.ok) throw new Error('Unauthenticated to download local vaults.');
      const vaultData = await resp.json();

      // 2. Upload to Supabase Storage Bucket
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `vault_backup_${timestamp}.json`;
      
      await uploadVaultToSupabase(filename, vaultData);
      setSuccessMsg(`Vault backed up successfully to Supabase Storage Bucket ('digital-vault') as [${filename}]!`);
      loadSupabaseBackups();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Supabase Cloud Storage Sync failed: ${err.message}`);
    } finally {
      setSyncingCloud(false);
    }
  };

  const handleRestoreFromSupabaseBackup = async (filename: string) => {
    if (!confirm(`Are you sure you want to restore the entire vault state from Supabase Cloud file: ${filename}?\n\nThis will load and synchronize all credentials into this active partition.`)) {
      return;
    }
    setImporting(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const restoredData = await downloadVaultFromSupabase(filename);
      if (!restoredData || !restoredData.accounts) {
        throw new Error('Supabase remote file schema mismatch or empty.');
      }

      // Restores elements bulk to Node backend
      const resp = await fetch('/api/import/vault', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rows: restoredData.accounts })
      });
      const rData = await resp.json();
      
      if (resp.ok) {
        setSuccessMsg(`Restored ${rData.count} credentials from Supabase Storage file [${filename}]! Rebooting...`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setErrorMsg(rData.error || 'Failed to commit credentials.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Cloud restore execution failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6" id="settings-card-wrapper">
      
      {/* Alert Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-950/20 text-emerald-400 border border-emerald-500/20 rounded-2xl text-xs font-semibold leading-relaxed text-left flex items-start gap-2.5 animate-fade-in">
          <Check className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-950/20 text-red-400 border border-red-500/20 rounded-2xl text-xs font-semibold leading-relaxed text-left flex items-start gap-2.5 animate-fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid Settings Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Profile Card / Setup */}
        <div className="bg-[#050505] border border-red-950/40 rounded-3xl p-6 space-y-5 text-left shadow-lg relative overflow-hidden crimson-glow">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/5 rounded-full blur-2xl pointer-events-none"></div>
          <h4 className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest flex items-center gap-2 font-display">
            <User className="w-4 h-4 text-red-500" />
            Vault Custodian Profile
          </h4>

          <form onSubmit={handleUpdateInfo} className="space-y-4 font-sans">
            <div className="space-y-1.5 text-left">
              <label className="text-[11px] text-slate-400 font-mono">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-[#0a0a0a] text-xs border border-red-950/60 rounded-2xl pl-10 pr-4 py-2.5 text-slate-200 focus:outline-none focus:border-red-650"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[11px] text-slate-400 font-mono">Registered Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full bg-[#0a0a0a] text-xs border border-red-950/60 rounded-2xl pl-10 pr-4 py-2.5 text-slate-200 focus:outline-none focus:border-red-650"
                />
              </div>
            </div>

            {/* Optional 2FA Section */}
            <div className="p-4 bg-[#0a0a0a] rounded-2xl border border-red-950/30 space-y-2 text-left">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs text-slate-200 font-bold block font-display">Two-Factor Sign In (2FA)</span>
                  <span className="text-[10px] text-slate-450 block leading-relaxed">Mandate system configuration audit validation</span>
                </div>
                <label className="inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={is2FA}
                    onChange={() => setIs2FA(!is2FA)}
                    className="sr-only peer"
                  />
                  <div className="relative w-9 h-5 bg-red-950/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-500 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-650 peer-checked:after:bg-slate-100" />
                </label>
              </div>
            </div>

            <button
              id="btn-update-profile"
              type="submit"
              disabled={profileSaving}
              className="w-full py-2.5 bg-red-950/20 hover:bg-red-900/30 text-red-500 text-xs font-semibold rounded-2xl border border-red-900/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
            >
              {profileSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" /> : null}
              Update Profile Credentials
            </button>
          </form>
        </div>

        {/* Change Master Password Card */}
        <div className="bg-[#050505] border border-red-950/40 rounded-3xl p-6 space-y-5 text-left shadow-lg crimson-glow">
          <h4 className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest flex items-center gap-2 font-display">
            <Key className="w-4 h-4 text-red-500" />
            Rotate Master Password
          </h4>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-[11px] text-slate-400 font-mono">Current Vault Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••••"
                className="w-full bg-[#0a0a0a] text-xs border border-red-950/60 rounded-2xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-red-650 placeholder:text-slate-700"
              />
            </div>
            
            <div className="space-y-1.5 text-left">
              <label className="text-[11px] text-slate-400 font-mono">New Vault Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••••"
                className="w-full bg-[#0a0a0a] text-xs border border-red-950/60 rounded-2xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-red-650 placeholder:text-slate-700"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[11px] text-slate-400 font-mono">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••••"
                className="w-full bg-[#0a0a0a] text-xs border border-red-950/60 rounded-2xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-red-650 placeholder:text-slate-700"
              />
            </div>

            <button
              id="btn-rotate-password"
              type="submit"
              disabled={passwordSaving}
              className="w-full py-2.5 bg-red-650 hover:bg-red-550 active:scale-[0.98] text-white text-xs font-semibold rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-red-950/30 shadow-md"
            >
              {passwordSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : null}
              Rotate Master Password
            </button>
          </form>
        </div>

        {/* Google Drive Cloud Integration Card */}
        <div className="bg-[#050505] border border-red-955/45 rounded-3xl p-6 space-y-5 text-left shadow-lg crimson-glow md:col-span-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-red-950/30 pb-4">
            <div className="text-left">
              <h4 className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest flex items-center gap-2 font-display">
                <CloudLightning className="w-4 h-4 text-red-500" />
                Google Drive Cloud Backup Sync
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Establish an automatic cloud-sync hook using your personal **Google Drive** storage to save and restore your secure credentials.
              </p>
            </div>
            <div className="flex gap-2">
              {googleUser ? (
                <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-emerald-950/30 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Connected: {googleUser.email}
                </span>
              ) : (
                <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-red-950/30 text-red-450 border border-red-500/20 flex items-center gap-1">
                  Cloud Offline
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Connection and Profile Controls */}
            <div className="lg:col-span-1 space-y-4 border-r border-red-950/20 pr-0 lg:pr-6 flex flex-col justify-between">
              <div>
                <h5 className="text-[10px] font-mono font-semibold text-slate-350 uppercase mb-2">Account Connection</h5>
                {googleUser ? (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-[#0a0a09] rounded-2xl border border-red-955/20 text-xs flex items-center gap-3">
                      {googleUser.photoURL ? (
                        <img src={googleUser.photoURL} alt="Google Hub" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border border-red-900/50" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-red-950/50 border border-red-900/50 flex items-center justify-center text-[10px] font-mono font-bold text-red-400 uppercase">
                          {googleUser.displayName?.charAt(0) || 'G'}
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-slate-200 block text-xs leading-none mb-1">{googleUser.displayName || 'Authorized Account'}</span>
                        <span className="font-mono text-[10px] text-slate-400 leading-none">{googleUser.email}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDisconnectGoogleDrive}
                      className="w-full py-2.5 bg-red-950/20 hover:bg-neutral-900 text-red-500 items-center justify-center text-xs font-semibold rounded-xl border border-red-900/30 transition-colors cursor-pointer text-center"
                    >
                      Disconnect Account
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 text-center py-4 bg-[#070303] border border-dashed border-red-950/30 rounded-2xl">
                    <button 
                      type="button"
                      onClick={handleConnectGoogleDrive}
                      className="gsi-material-button text-left justify-center cursor-pointer inline-flex w-11/12 mx-auto"
                      style={{ 
                        WebkitBorderRadius: '12px', 
                        borderRadius: '12px', 
                        boxSizing: 'border-box', 
                        color: '#1f1f1f', 
                        cursor: 'pointer', 
                        fontFamily: '"Roboto", arial, sans-serif', 
                        fontSize: '13px', 
                        height: '38px', 
                        letterSpacing: '0.25px', 
                        outline: 'none', 
                        overflow: 'hidden', 
                        padding: '0 12px', 
                        position: 'relative', 
                        textAlign: 'center', 
                        transition: 'background-color .218s, border-color .218s, box-shadow .218s', 
                        verticalAlign: 'middle', 
                        whiteSpace: 'nowrap', 
                        width: 'auto', 
                        maxWidth: '400px', 
                        minWidth: 'min-content', 
                        border: '1px solid #747775', 
                        backgroundColor: '#fff' 
                      }}
                    >
                      <div className="gsi-material-button-state" style={{ 
                        WebkitTransition: 'opacity .218s ease-in-out', 
                        transition: 'opacity .218s ease-in-out', 
                        borderRadius: '12px', 
                        inset: '0', 
                        opacity: '0', 
                        position: 'absolute' 
                      }}></div>
                      <div className="gsi-material-button-content-wrapper" style={{ 
                        alignItems: 'center', 
                        display: 'flex', 
                        flexDirection: 'row', 
                        flexWrap: 'nowrap', 
                        height: '100%', 
                        justifyContent: 'space-between', 
                        position: 'relative', 
                        width: '100%', 
                        zIndex: '1' 
                      }}>
                        <div className="gsi-material-button-icon" style={{ 
                          display: 'block', 
                          height: '20px', 
                          minWidth: '20px', 
                          width: '20px',
                          marginRight: '8.5px'
                        }}>
                          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                            <path fill="none" d="M0 0h48v48H0z"></path>
                          </svg>
                        </div>
                        <span className="gsi-material-button-contents" style={{ 
                          fontFamily: '"Roboto", arial, sans-serif', 
                          fontSize: '13px', 
                          fontWeight: '500', 
                          letterSpacing: '0.25px', 
                          whiteSpace: 'nowrap',
                          color: '#1f1f1f'
                        }}>Sign in with Google</span>
                      </div>
                    </button>
                    <p className="text-[10px] text-slate-500 max-w-xs mx-auto px-4 mt-2 font-mono">
                      Request permission to store backups in Google Drive.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Google Drive backup list and actions */}
            <div className="lg:col-span-2 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-[10px] font-mono font-semibold text-slate-350 uppercase flex items-center gap-1.5 font-display">
                    <Database className="w-3.5 h-3.5 text-red-500" />
                    Google Cloud Backup Archives
                  </h5>
                  {googleUser && (
                    <button
                      onClick={loadGoogleDriveBackups}
                      disabled={loadingGoogleBackups}
                      className="p-1 px-2.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 text-[10px] rounded-lg cursor-pointer transition-colors flex items-center gap-1 font-mono"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingGoogleBackups ? 'animate-spin' : ''}`} />
                      Refresh list
                    </button>
                  )}
                </div>

                {!googleUser ? (
                  <div className="p-8 text-center bg-[#070303] border border-red-955/35 rounded-2xl">
                    <ShieldAlert className="w-6 h-6 text-red-500/55 mx-auto mb-2" />
                    <span className="text-[10.5px] text-slate-500 block">Link Google Account above to authorize secure direct-cloud backup sync.</span>
                  </div>
                ) : loadingGoogleBackups ? (
                  <div className="py-8 flex justify-center items-center">
                    <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
                  </div>
                ) : googleBackups.length === 0 ? (
                  <div className="p-6 text-center bg-[#070303] border border-red-900/10 rounded-2xl flex flex-col items-center gap-1">
                    <span className="text-[10.5px] text-slate-400 font-semibold font-mono">No backup archives discovered</span>
                    <span className="text-[10px] text-slate-500">Create your first instant Google Drive session backup below.</span>
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-2 border border-red-955/35 rounded-xl p-2 bg-[#020202]">
                    {googleBackups.map((b) => (
                      <div key={b.id} className="flex items-center justify-between p-2.5 bg-[#0a0a0a] border border-red-950/15 hover:border-red-950/45 rounded-lg transition-colors text-xs animate-fade-in">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-red-500 shrink-0" />
                          <div className="text-left font-mono">
                            <span className="text-[#f1f5f9] block truncate max-w-xs text-xs">{b.name}</span>
                            <span className="text-[9px] text-[#94a3b8] block">Date: {new Date(b.createdTime).toLocaleString()}</span>
                            {b.size && <span className="text-[9px] text-slate-500 mt-0.5 block font-sans">Size: {(parseFloat(b.size) / 1024).toFixed(1)} KB</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRestoreFromGoogleDrive(b.id, b.name)}
                          className="px-2.5 py-1 bg-red-950/20 hover:bg-red-900/40 border border-red-900/30 text-red-400 text-[10px] rounded hover:scale-105 transition-all cursor-pointer font-semibold"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {googleUser && (
                <button
                  type="button"
                  disabled={syncingGoogle}
                  onClick={handleBackupToGoogleDrive}
                  className="w-full mt-2 py-2 bg-red-650 hover:bg-red-550 active:scale-[0.98] text-white text-xs font-semibold rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  {syncingGoogle ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <CloudLightning className="w-4 h-4" />}
                  Incremental Backup to Google Drive Secure Storage
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Supabase Storage Cloud Integration Card */}
        <div className="bg-[#050505] border border-red-950/40 rounded-3xl p-6 space-y-5 text-left shadow-lg crimson-glow md:col-span-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-red-950/30 pb-4">
            <div className="text-left">
              <h4 className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest flex items-center gap-2 font-display">
                <Database className="w-4 h-4 text-red-500" />
                Supabase Cloud Storage Integration
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Establish an automatic cloud-sync hook using direct **Supabase Storage** to save and restore your credentials database.
              </p>
            </div>
            <div className="flex gap-2">
              {supabaseUrl && supabaseKey ? (
                <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-emerald-950/30 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active Connection
                </span>
              ) : (
                <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-red-950/30 text-red-450 border border-red-500/20 flex items-center gap-1">
                  Disconnected
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Supabase configuration input form */}
            <div className="lg:col-span-1 space-y-4 border-r border-red-950/20 pr-0 lg:pr-6">
              <h5 className="text-[10px] font-mono font-semibold text-slate-350 uppercase">Connection Details</h5>
              
              <form onSubmit={handleSaveSupabaseKeys} className="space-y-3">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] text-slate-400 font-mono">Supabase Project URL</label>
                  <input
                    type="url"
                    required
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://yourproject.supabase.co"
                    className="w-full bg-[#0a0a0a] text-xs border border-red-950/60 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-red-650"
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[10px] text-slate-400 font-mono">SUPABASE ANON / API KEY</label>
                  <input
                    type="password"
                    required
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full bg-[#0a0a0a] text-xs border border-red-950/60 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-red-650 font-mono text-[9px]"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 bg-red-650 hover:bg-red-550 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Save &amp; Connect
                  </button>
                  {(supabaseUrl || supabaseKey) && (
                    <button
                      type="button"
                      onClick={handleResetSupabaseKeys}
                      className="px-2.5 py-1.5 bg-red-950/10 hover:bg-red-900/20 border border-red-900/30 text-red-400 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Supabase backup list and utilities */}
            <div className="lg:col-span-2 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-[10px] font-mono font-semibold text-slate-350 uppercase flex items-center gap-1.5">
                    <CloudLightning className="w-3.5 h-3.5 text-red-500" />
                    Supabase storage Backups
                  </h5>
                  {supabaseUrl && supabaseKey && (
                    <button
                      onClick={loadSupabaseBackups}
                      disabled={loadingBackups}
                      className="p-1 px-2.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 text-[10px] rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingBackups ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  )}
                </div>

                {!(supabaseUrl && supabaseKey) ? (
                  <div className="p-8 text-center bg-[#070303] border border-red-950/30 rounded-2xl">
                    <ShieldAlert className="w-6 h-6 text-red-500/55 mx-auto mb-2" />
                    <span className="text-[10.5px] text-slate-500 block">Configure and connect your Supabase credentials to access cloud storage capabilities.</span>
                  </div>
                ) : loadingBackups ? (
                  <div className="py-8 flex justify-center items-center">
                    <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
                  </div>
                ) : supabaseBackups.length === 0 ? (
                  <div className="p-6 text-center bg-[#070303] border border-red-900/10 rounded-2xl flex flex-col items-center gap-1">
                    <span className="text-[10.5px] text-slate-400 font-semibold">No backup archives discovered</span>
                    <span className="text-[10px] text-slate-500">Initiate your first Supabase Cloud storage session backup today.</span>
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-2 border border-red-950/20 rounded-xl p-2 bg-[#020202]">
                    {supabaseBackups.map((b) => (
                      <div key={b.name} className="flex items-center justify-between p-2.5 bg-[#0a0a0a] border border-red-950/10 hover:border-red-950/40 rounded-lg transition-colors text-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-red-500 shrink-0" />
                          <div className="text-left font-mono">
                            <span className="text-[#f1f5f9] block truncate max-w-xs">{b.name}</span>
                            <span className="text-[9px] text-[#94a3b8]">Size: {((b.metadata?.size || 0) / 1024).toFixed(1)} KB</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRestoreFromSupabaseBackup(b.name)}
                          className="px-2.5 py-1 bg-red-950/20 hover:bg-red-900/30 border border-red-900/30 text-red-400 text-[10px] rounded hover:scale-105 transition-all cursor-pointer font-semibold"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {supabaseUrl && supabaseKey && (
                <button
                  type="button"
                  disabled={syncingCloud}
                  onClick={handleBackupToSupabaseCloud}
                  className="w-full mt-2 py-2 bg-red-650 hover:bg-red-550 active:scale-[0.98] text-white text-xs font-semibold rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  {syncingCloud ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <CloudLightning className="w-4 h-4" />}
                  Incremental Backup to Supabase Storage Container
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Secure Backup export, CSV parsing area */}
        <div className="bg-[#050505] border border-red-950/40 rounded-3xl p-6 space-y-5 text-left shadow-lg crimson-glow">
          <h4 className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest flex items-center gap-2 font-display">
            <Download className="w-4 h-4 text-red-500" />
            Bulk Backup &amp; Data Portability
          </h4>

          <p className="text-xs text-slate-400 leading-relaxed">
            Download your encrypted vault payload. Keeps all passwords, recovery backup pins, balance ledgers, and notes fully decoupled.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => handleExportVault('json')}
              className="py-3 px-3.5 bg-[#0a0a0a] hover:bg-red-950/10 border border-red-950/30 hover:border-red-900/30 text-slate-200 hover:text-red-550 text-xs font-bold rounded-2xl text-center transition-all flex flex-col items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <FileText className="w-5 h-5 text-red-500" />
              <span>Export as JSON</span>
            </button>
            <button
              onClick={() => handleExportVault('csv')}
              className="py-3 px-3.5 bg-[#0a0a0a] hover:bg-red-950/10 border border-red-950/30 hover:border-red-900/30 text-slate-200 hover:text-red-550 text-xs font-bold rounded-2xl text-center transition-all flex flex-col items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <FileText className="w-5 h-5 text-red-500" />
              <span>Export as CSV</span>
            </button>
          </div>
        </div>

        {/* Vault Restore & Disaster Area */}
        <div className="bg-[#050505] border border-red-950/40 rounded-3xl p-6 space-y-4 text-left shadow-lg crimson-glow">
          <h4 className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest flex items-center gap-2 font-display">
            <Upload className="w-4 h-4 text-red-500" />
            Restore Database &amp; CSV Import
          </h4>

          <p className="text-xs text-slate-400 leading-relaxed">
            Upload CSV list templates directly to load multiple accounts under the secure vault in one click. Expected headers listed inside database schemas.
          </p>

          <div className="pt-2">
            <label className="w-full h-11 bg-[#0a0a0a] hover:bg-red-950/10 text-xs font-semibold text-slate-400 hover:text-slate-100 border border-dashed border-red-905/40 hover:border-red-900/65 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all">
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                  <span>Seeding CSV rows...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>Choose CSV backup file</span>
                </>
              )}
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                disabled={importing}
                className="hidden"
              />
            </label>
          </div>

          <div className="p-3.5 bg-red-950/5 border border-red-950/20 rounded-2xl space-y-2">
            <span className="text-[9px] text-red-500 font-bold block uppercase font-mono">DANGER ZONE</span>
            <button
              id="btn-delete-entire-vault"
              onClick={handleDeleteProfile}
              className="w-full py-2 bg-red-950/20 hover:bg-red-900/30 text-rose-500 text-xs font-semibold rounded-2xl border border-red-900/25 transition-all text-center cursor-pointer font-display font-medium"
            >
              Permanently Delete Vault Database
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
