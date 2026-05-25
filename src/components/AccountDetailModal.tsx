import { useState, useEffect } from 'react';
import { 
  X, Copy, Check, Eye, EyeOff, Edit2, 
  Trash2, Pin, Star, Globe, Shield, DollarSign, Info, Calendar, Loader2
} from 'lucide-react';
import { Account, CurrencyCode, AccountCategory, SecurityQuestion } from '../types.js';

interface DetailProps {
  account: Account | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: Account) => void;
  onDelete: (id: string) => void;
  token: string | null;
}

export default function AccountDetailModal({ account, isOpen, onClose, onUpdate, onDelete, token }: DetailProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [loadingReveal, setLoadingReveal] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  
  // Decrypted values (cached upon unlock/reveal click)
  const [decryptedData, setDecryptedData] = useState<{
    password?: string;
    recoveryEmail?: string;
    recoveryPhone?: string;
    backupCodes?: string;
    securityQuestions?: SecurityQuestion[];
    authenticatorSecret?: string;
  } | null>(null);

  // Copy states for individual fields
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form states (editing)
  const [title, setTitle] = useState('');
  const [platformName, setPlatformName] = useState('');
  const [category, setCategory] = useState<AccountCategory>('Custom');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [username, setUsername] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [backupCodes, setBackupCodes] = useState('');
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([]);
  const [authenticatorSecretKey, setAuthenticatorSecretKey] = useState('');
  const [passkeysNotes, setPasskeysNotes] = useState('');
  
  // Financial states
  const [balance, setBalance] = useState<number>(0);
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [earnings, setEarnings] = useState<number>(0);
  const [withdrawnAmount, setWithdrawnAmount] = useState<number>(0);
  const [availableAmount, setAvailableAmount] = useState<number>(0);
  
  // Other states
  const [status, setStatus] = useState<'active' | 'suspended' | 'inactive'>('active');
  const [notes, setNotes] = useState('');
  const [tagsText, setTagsText] = useState('');
  
  // Local password reveal toggle for display
  const [showPlainPassword, setShowPlainPassword] = useState<boolean>(false);

  // Load state when account changes
  useEffect(() => {
    if (account) {
      setTitle(account.title || '');
      setPlatformName(account.platformName || '');
      setCategory(account.category || 'Custom');
      setWebsiteUrl(account.websiteUrl || '');
      setUsername(account.username || '');
      setLoginEmail(account.loginEmail || '');
      setNewPassword(''); // Will remain empty unless user overwrites in edit
      
      setPasskeysNotes(account.passkeysNotes || '');
      setBalance(account.balance || 0);
      setCurrency(account.currency || 'USD');
      setEarnings(account.earnings || 0);
      setWithdrawnAmount(account.withdrawnAmount || 0);
      setAvailableAmount(account.availableAmount || 0);
      setStatus(account.status || 'active');
      setNotes(account.notes || '');
      setTagsText(account.tags ? account.tags.join(', ') : '');
      
      setIsEditing(false);
      setDecryptedData(null);
      setShowPlainPassword(false);
    }
  }, [account]);

  if (!isOpen || !account) return null;

  // Reveal encrypted variables via secure endpoint
  const handleRevealSecrets = async () => {
    if (decryptedData) return; // already revealed
    setLoadingReveal(true);
    try {
      const resp = await fetch(`/api/accounts/${account.id}/reveal`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.ok) {
        setDecryptedData(data);
        setNewPassword(data.password || '');
        setRecoveryEmail(data.recoveryEmail || '');
        setRecoveryPhone(data.recoveryPhone || '');
        setBackupCodes(data.backupCodes || '');
        setSecurityQuestions(data.securityQuestions || []);
        setAuthenticatorSecretKey(data.authenticatorSecret || '');
      } else {
        alert(data.error || 'Failed to decrypt credentials.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReveal(false);
    }
  };

  const copyField = (text: string | undefined, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleToggleFavorite = async () => {
    try {
      const resp = await fetch(`/api/accounts/${account.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isFavorite: !account.isFavorite })
      });
      if (resp.ok) {
        const updated = await resp.json();
        onUpdate(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePin = async () => {
    try {
      const resp = await fetch(`/api/accounts/${account.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isPinned: !account.isPinned })
      });
      if (resp.ok) {
        const updated = await resp.json();
        onUpdate(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addSecurityQuestion = () => {
    setSecurityQuestions([...securityQuestions, { question: '', answer: '' }]);
  };

  const removeSecurityQuestion = (index: number) => {
    const updated = [...securityQuestions];
    updated.splice(index, 1);
    setSecurityQuestions(updated);
  };

  const handleQuestionChange = (index: number, key: 'question' | 'answer', val: string) => {
    const updated = [...securityQuestions];
    updated[index][key] = val;
    setSecurityQuestions(updated);
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    const tagsArr = tagsText.split(',').map(t => t.trim()).filter(t => t.length > 0);

    const body: any = {
      title,
      platformName,
      category,
      websiteUrl,
      username,
      loginEmail,
      passkeysNotes,
      balance,
      currency,
      earnings,
      withdrawnAmount,
      availableAmount,
      status,
      notes,
      tags: tagsArr
    };

    if (decryptedData) {
      body.passwordEncrypted = newPassword;
      body.recoveryEmailEncrypted = recoveryEmail;
      body.recoveryPhoneEncrypted = recoveryPhone;
      body.backupCodesEncrypted = backupCodes;
      body.securityQuestionsEncrypted = JSON.stringify(securityQuestions);
      body.authenticatorSecretKeyEncrypted = authenticatorSecretKey;
    }

    try {
      const resp = await fetch(`/api/accounts/${account.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (resp.ok) {
        const updated = await resp.json();
        onUpdate(updated);
        setIsEditing(false);
        setDecryptedData(null); 
      } else {
        const err = await resp.json();
        alert(err.error || 'Failed to update credentials.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="modal-wrapper" className="fixed inset-0 z-50 flex justify-end bg-[#000000]/85 backdrop-blur-md animate-fade-in font-sans">
      <div 
        id="detail-panel" 
        className="w-full max-w-2xl bg-[#050505] border-l border-red-955/40 h-full flex flex-col shadow-2xl overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-red-955/20 bg-gradient-to-r from-[#0a0506] to-[#040404] sticky top-0 z-10 text-left">
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
              account.category === 'Gmail' ? 'bg-red-950/20 text-red-400 border-red-900/30' :
              account.category === 'Crypto' ? 'bg-red-950/20 text-red-500 border-red-900/30' :
              account.category === 'Banking' ? 'bg-red-950/20 text-red-400 border-red-900/30' :
              'bg-red-950/20 text-red-500 border-red-900/30'
            }`}>
              {account.category}
            </span>
            <h3 className="text-md font-bold text-slate-100 font-display ellipsis max-w-xs">{account.title}</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-fav-detail"
              onClick={handleToggleFavorite}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                account.isFavorite 
                  ? 'bg-red-950/25 border-red-900/40 text-red-500' 
                  : 'bg-[#0a0a0a] border-red-955/45 text-slate-500 hover:text-slate-350'
              }`}
            >
              <Star className="w-4 h-4" />
            </button>
            <button
              id="btn-pin-detail"
              onClick={handleTogglePin}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                account.isPinned 
                  ? 'bg-red-950/25 border-red-900/40 text-red-500' 
                  : 'bg-[#0a0a0a] border-red-955/45 text-slate-500 hover:text-slate-350'
              }`}
            >
              <Pin className="w-4 h-4" />
            </button>

            {!isEditing && (
              <button
                id="btn-edit-detail"
                onClick={() => {
                  handleRevealSecrets(); 
                  setIsEditing(true);
                }}
                className="p-1.5 rounded-lg bg-[#0a0a0a] border border-red-955/45 hover:border-red-900/40 text-slate-300 hover:text-red-400 transition-all cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}

            <button
              id="btn-close-detail"
              onClick={onClose}
              className="p-1.5 bg-[#0a0a0a] hover:bg-neutral-900 text-slate-450 hover:text-slate-105 rounded-lg border border-red-955/45 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1 text-left">
          {isEditing ? (
            /* =================================================================
               EDITING STATE FORM
               ================================================================= */
            <div className="space-y-5" id="editing-form-active">
              <h4 className="text-xs font-mono text-red-550 uppercase tracking-widest text-left font-bold">Modifying Vault Credentials</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Account Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-red-655"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Platform Name</label>
                  <input
                    type="text"
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-red-655"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Category Selection</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AccountCategory)}
                    className="w-full bg-[#0a0a0a] text-[#f1f5f9] text-sm border border-red-955/60 rounded-xl px-3 py-2 focus:outline-none focus:border-red-655 cursor-pointer"
                  >
                    <option value="Gmail">Gmail</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Banking">Banking</option>
                    <option value="Crypto">Crypto</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Business">Business</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Website URL</label>
                  <input
                    type="text"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-red-655"
                    placeholder="https://"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Username / ID</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-red-655"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Login Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-red-655"
                  />
                </div>
              </div>

              <hr className="border-red-955/20" />

              {/* Secure Credentials Fieldset */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-red-500">
                  <Shield className="w-4 h-4 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-widest font-sans">Secrets & Passwords</span>
                </div>

                {!decryptedData ? (
                  <button
                    type="button"
                    onClick={handleRevealSecrets}
                    className="w-full text-xs text-slate-300 bg-[#0a0a0a] border border-red-955/45 hover:border-red-900/50 py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    {loadingReveal ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Eye className="w-4 h-4" />}
                    Unlock and decrypt vault fields for modification
                  </button>
                ) : (
                  <div className="space-y-4 text-left">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Password</label>
                      <input
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-3 py-2 text-[#f1f5f9] font-mono focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Recovery Email</label>
                        <input
                          type="email"
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-red-655"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Recovery Phone</label>
                        <input
                          type="text"
                          value={recoveryPhone}
                          onChange={(e) => setRecoveryPhone(e.target.value)}
                          className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-red-655"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Authenticator Secret (2FA Key)</label>
                        <input
                          type="text"
                          value={authenticatorSecretKey}
                          onChange={(e) => setAuthenticatorSecretKey(e.target.value)}
                          className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-3 py-2 text-slate-200 font-mono focus:border-red-655"
                          placeholder="JBSWY3DP..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Passkeys Presence / Notes</label>
                        <input
                          type="text"
                          value={passkeysNotes}
                          onChange={(e) => setPasskeysNotes(e.target.value)}
                          className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-3 py-2 text-[#f1f5f9] focus:border-red-655"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 flex justify-between">
                        <span>Backup Recovery Codes</span>
                        <span className="text-[9px] text-slate-500 font-mono">Comma-separated</span>
                      </label>
                      <textarea
                        value={backupCodes}
                        onChange={(e) => setBackupCodes(e.target.value)}
                        className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-3 py-2 text-[#f1f5f9] font-mono h-18 focus:border-red-655"
                        placeholder="1234-5678, ABCD-EFG1..."
                      />
                    </div>

                    {/* Security Questions List */}
                    <div className="space-y-2 pt-2 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Security Questions ({securityQuestions.length})</span>
                        <button
                          type="button"
                          onClick={addSecurityQuestion}
                          className="text-[10px] text-red-500 hover:text-red-400 font-bold cursor-pointer"
                        >
                          + Add Question
                        </button>
                      </div>

                      <div className="space-y-3">
                        {securityQuestions.map((q, idx) => (
                           <div key={idx} className="flex gap-2 items-end bg-[#000000] p-3 rounded-lg border border-red-955/35">
                             <div className="flex-1 space-y-2 text-left">
                               <input
                                 placeholder="Secret Question (e.g. First pet?)"
                                 value={q.question}
                                 onChange={(e) => handleQuestionChange(idx, 'question', e.target.value)}
                                 className="w-full bg-[#0a0a0a] text-xs border border-red-955/60 px-2.5 py-1.5 text-slate-200 focus:outline-none"
                               />
                               <input
                                 placeholder="Answer"
                                 value={q.answer}
                                 onChange={(e) => handleQuestionChange(idx, 'answer', e.target.value)}
                                 className="w-full bg-[#0a0a0a] text-xs border border-red-955/60 px-2.5 py-1.5 text-slate-205 focus:outline-none"
                               />
                             </div>
                             <button
                               type="button"
                               onClick={() => removeSecurityQuestion(idx)}
                               className="text-red-500 text-xs px-2 py-1 bg-red-950/20 hover:bg-red-950/40 rounded cursor-pointer border border-red-900/20"
                             >
                               Remove
                             </button>
                           </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <hr className="border-red-955/20" />

              {/* Financial Balance Section */}
              <div className="space-y-4 text-left">
                <div className="flex items-center gap-2 text-red-500">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-widest font-sans">Account Balances &amp; Earnings</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Current Balance</label>
                    <input
                      type="number"
                      value={balance}
                      onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-2.5 py-2 text-[#f1f5f9]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                      className="w-full bg-[#0a0a0a] text-[#f1f5f9] text-sm border border-red-955/60 rounded-xl px-2.5 py-2 cursor-pointer"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="BDT">BDT (৳)</option>
                      <option value="INR">INR (₹)</option>
                      <option value="BTC">BTC (₿)</option>
                      <option value="ETH">ETH (Ξ)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Earnings</label>
                    <input
                      type="number"
                      value={earnings}
                      onChange={(e) => setEarnings(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-2.5 py-2 text-[#f1f5f9]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Withdrawn</label>
                    <input
                      type="number"
                      value={withdrawnAmount}
                      onChange={(e) => setWithdrawnAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-2.5 py-2 text-[#f1f5f9]"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-red-955/20" />

              {/* Status and metadata */}
              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-[#f1f5f9] py-2 text-[#f1f5f9]"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 flex justify-between">
                    <span>Tags</span>
                    <span className="text-[9px] text-slate-500 font-mono">Comma-separated</span>
                  </label>
                  <input
                    type="text"
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-3 py-2 text-[#f1f5f9]"
                    placeholder="Work, API, Private"
                  />
                </div>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-xs text-slate-400">Private Notes & Security Comments</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#0a0a0a] text-sm border border-red-955/60 rounded-xl px-3 py-2 text-[#f1f5f9] h-24 focus:border-red-655 focus:outline-none"
                  placeholder="Insert notes, recovery seeds..."
                />
              </div>

              {/* Edit Buttons action footer */}
              <div className="flex gap-3 justify-end pt-4 border-t border-red-955/20 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 bg-black hover:bg-neutral-900 border border-red-955/35 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-650 hover:bg-red-550 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : null}
                  Confirm Updates
                </button>
              </div>
            </div>
          ) : (
            /* =================================================================
               READ-ONLY AUDITING VIEW STATE
               ================================================================= */
            <div className="space-y-6 text-left animate-fade-in animate-duration-200" id="readonly-detail-view text-left">
              
              {/* Basic credentials group */}
              <div className="bg-[#0a0a0a]/50 rounded-2xl border border-red-955/20 p-5 space-y-4 shadow-sm">
                <h4 className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest flex items-center gap-2 mb-2 text-left">
                  <Globe className="w-4 h-4 text-red-500" />
                  Primary Security Credentials
                </h4>

                {/* Primary Site website view & reveal */}
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono block">Platform / Brand</span>
                    <span className="text-sm font-semibold text-slate-205 font-display">{account.platformName || 'Generic'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono block">Website URL Link</span>
                    {account.websiteUrl ? (
                      <a 
                        href={account.websiteUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-sm text-red-400 hover:text-red-300 font-medium underline flex items-center gap-1.5 break-all font-mono"
                      >
                        {account.websiteUrl}
                      </a>
                    ) : (
                      <span className="text-sm text-slate-450 italic">None configured</span>
                    )}
                  </div>
                </div>

                <hr className="border-red-955/20" />

                <div className="space-y-3 text-left">
                  {/* User field with quick copy */}
                  <div className="flex items-center justify-between py-1.5 px-3 bg-[#000000]/70 rounded-xl border border-red-955/35">
                    <div className="ellipsis max-w-sm text-left">
                      <span className="text-[10px] text-slate-500 font-mono block">Username / Account ID</span>
                      <span className="text-sm font-semibold text-slate-200 font-mono">{account.username || 'Not Available'}</span>
                    </div>
                    {account.username && (
                      <button
                        id="copy-user-detail"
                        onClick={() => copyField(account.username, 'username')}
                        className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                      >
                        {copiedField === 'username' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {/* Email field with quick copy */}
                  <div className="flex items-center justify-between py-1.5 px-3 bg-[#000000]/70 rounded-xl border border-red-955/35">
                    <div className="ellipsis max-w-sm text-left">
                      <span className="text-[10px] text-slate-500 font-mono block">Login Email Address</span>
                      <span className="text-sm font-semibold text-slate-250 font-mono">{account.loginEmail || 'None'}</span>
                    </div>
                    {account.loginEmail && (
                      <button
                        id="copy-email-detail"
                        onClick={() => copyField(account.loginEmail, 'loginEmail')}
                        className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                      >
                        {copiedField === 'loginEmail' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {/* Encrypted Password Section */}
                  <div className="flex items-center justify-between py-1.5 px-3 bg-[#000000]/70 rounded-xl border border-red-955/35">
                    <div className="text-left">
                      <span className="text-[10px] text-slate-500 font-mono block">Vault Password Key</span>
                      <span className="text-sm font-mono font-bold">
                        {showPlainPassword && decryptedData?.password ? (
                          <span className="select-all text-red-400">{decryptedData.password}</span>
                        ) : (
                          '••••••••••••••••'
                        )}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        id="btn-reveal-pwd"
                        onClick={async () => {
                          if (!decryptedData) {
                            await handleRevealSecrets();
                          }
                          setShowPlainPassword(!showPlainPassword);
                        }}
                        disabled={loadingReveal}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer transition-all"
                        title="Reveal password"
                      >
                        {loadingReveal ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                        ) : showPlainPassword ? (
                          <EyeOff className="w-3.5 h-3.5 text-red-505" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {(showPlainPassword || decryptedData) && (
                        <button
                          id="copy-pwd-detail"
                          onClick={() => copyField(decryptedData?.password, 'password_text')}
                          className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          {copiedField === 'password_text' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Shield & 2FA Recovery Area */}
              <div className="bg-[#0a0a0a]/50 rounded-2xl border border-red-955/20 p-5 space-y-4">
                <div className="flex justify-between items-center text-left">
                  <h4 className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-500 animate-pulse" />
                    Cryptographic 2FA &amp; Phone Verification
                  </h4>

                  {!decryptedData && (
                    <button
                      onClick={handleRevealSecrets}
                      disabled={loadingReveal}
                      className="text-[10px] font-bold text-red-500 hover:text-red-450 underline cursor-pointer flex items-center gap-1 font-mono"
                    >
                      {loadingReveal ? <Loader2 className="w-3 h-3 animate-spin text-red-500" /> : null}
                      [Decrypt Credentials]
                    </button>
                  )}
                </div>

                {decryptedData ? (
                  <div className="space-y-4 font-sans text-left">
                    {decryptedData.recoveryEmail && (
                      <div className="flex items-center justify-between py-1 px-3 bg-[#000000]/60 rounded-xl border border-red-955/30">
                        <div>
                          <span className="text-[9px] text-slate-500 font-mono block">Backup Recovery Email</span>
                          <span className="text-xs text-slate-200 font-mono">{decryptedData.recoveryEmail}</span>
                        </div>
                        <button
                          onClick={() => copyField(decryptedData.recoveryEmail, 'rec_email')}
                          className="p-1 text-slate-405 hover:text-red-500"
                        >
                          {copiedField === 'rec_email' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}

                    {decryptedData.recoveryPhone && (
                      <div className="flex items-center justify-between py-1 px-3 bg-[#000000]/60 rounded-xl border border-red-955/30">
                        <div>
                          <span className="text-[9px] text-slate-500 font-mono block">Recovery Phone Code</span>
                          <span className="text-xs text-slate-200 font-mono">{decryptedData.recoveryPhone}</span>
                        </div>
                        <button
                          onClick={() => copyField(decryptedData.recoveryPhone, 'rec_phone')}
                          className="p-1 text-slate-405 hover:text-red-500"
                        >
                          {copiedField === 'rec_phone' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}

                    {decryptedData.authenticatorSecret && (
                      <div className="flex items-center justify-between py-1 px-3 bg-[#000000]/60 rounded-xl border border-red-955/30 animate-fade-in">
                        <div>
                          <span className="text-[9px] text-slate-500 font-mono block">MFA / 2FA TOTP secret key</span>
                          <span className="text-xs text-red-400 font-mono font-bold tracking-wider">{decryptedData.authenticatorSecret}</span>
                        </div>
                        <button
                          onClick={() => copyField(decryptedData.authenticatorSecret, 'auth_sec')}
                          className="p-1 text-slate-405 hover:text-red-505"
                        >
                          {copiedField === 'auth_sec' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}

                    {decryptedData.backupCodes && (
                      <div className="p-3 bg-[#000000]/60 rounded-xl border border-red-955/35 space-y-1">
                        <div className="flex items-center justify-between border-b border-red-955/20 pb-1.5 mb-1.5">
                          <span className="text-[10px] text-slate-500 font-mono">Vault Recovery Single-Use Codes</span>
                          <button
                            onClick={() => copyField(decryptedData.backupCodes, 'backup_codes')}
                            className="text-[10px] text-red-500 hover:text-red-400 font-semibold font-mono flex items-center gap-1 cursor-pointer"
                          >
                            {copiedField === 'backup_codes' ? 'Copied Codes!' : 'Copy codes buffer'}
                          </button>
                        </div>
                        <span className="text-xs text-red-500/80 font-mono block whitespace-pre-line leading-relaxed font-semibold">
                          {decryptedData.backupCodes}
                        </span>
                      </div>
                    )}

                    {decryptedData.securityQuestions && decryptedData.securityQuestions.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-505 font-mono block">Security Challenge Q/A Checkpoints</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {decryptedData.securityQuestions.map((q, idx) => (
                            <div key={idx} className="p-2.5 bg-[#000000]/80 rounded-lg border border-red-955/30 text-xs text-left">
                              <span className="text-slate-405 block font-semibold mb-1">Quest: {q.question || 'Challenge?'}</span>
                              <div className="flex justify-between items-center bg-[#070707] border border-red-955/40 px-2 py-1 rounded">
                                <span className="font-mono text-red-400 font-bold">{q.answer}</span>
                                <button
                                  onClick={() => copyField(q.answer, `ans_${idx}`)}
                                  className="text-[9px] text-[#555] hover:text-red-550"
                                >
                                  {copiedField === `ans_${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-505 italic text-left">All MFA verification credentials, security passwords, and API backup phrases are kept in AES format. Unlock contents using the trigger above.</p>
                )}
              </div>

              {/* Financial Ledger Section */}
              <div className="bg-[#0a0a0a]/50 rounded-2xl border border-red-955/20 p-5 space-y-4">
                <h4 className="text-xs font-mono font-bold text-red-550 uppercase tracking-widest flex items-center gap-2 text-left">
                  <DollarSign className="w-4 h-4 text-red-500" />
                  Symmetric Account Book Statistics
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                  <div className="bg-[#000000] p-3 rounded-xl border border-red-955/25">
                    <span className="text-[9px] text-slate-500 font-mono block">Account Balance</span>
                    <span className="text-xs font-bold text-red-400 font-mono">{account.balance} {account.currency}</span>
                  </div>
                  <div className="bg-[#000000] p-3 rounded-xl border border-red-955/25">
                    <span className="text-[9px] text-slate-500 font-mono block">Monthly Income</span>
                    <span className="text-xs font-bold text-slate-350 font-mono">{account.earnings} {account.currency}</span>
                  </div>
                  <div className="bg-[#000000] p-3 rounded-xl border border-red-955/25">
                    <span className="text-[9px] text-slate-500 font-mono block">Withdrawn Amount</span>
                    <span className="text-xs font-bold text-slate-355 font-mono">{account.withdrawnAmount} {account.currency}</span>
                  </div>
                  <div className="bg-[#000000] p-3 rounded-xl border border-red-955/25">
                    <span className="text-[9px] text-slate-500 font-mono block">Secured Liquid</span>
                    <span className="text-xs font-bold text-red-501 font-mono">{account.availableAmount} {account.currency}</span>
                  </div>
                </div>

                {account.passkeysNotes && (
                  <div className="p-3 bg-red-950/10 text-[11px] text-slate-300 rounded-xl border border-red-900/20 flex gap-2 text-left">
                    <Info className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-red-400 font-mono block mb-0.5">Physical Device / Passkey status</span>
                      {account.passkeysNotes}
                    </div>
                  </div>
                )}
              </div>

              {/* Tag metadata & Additional notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                {account.notes && (
                  <div className="bg-[#0a0a0a]/50 rounded-2xl border border-red-955/20 p-5 space-y-2">
                    <span className="text-xs font-mono font-bold text-slate-400 uppercase block">Private Comments</span>
                    <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">{account.notes}</p>
                  </div>
                )}

                <div className="bg-[#0a0a0a]/50 rounded-2xl border border-red-955/20 p-5 space-y-4">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-400 uppercase block mb-2">Vault Metadata Metrics</span>
                    <div className="space-y-2 text-xs text-slate-400 font-sans">
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <span className={`font-semibold font-mono ${account.status === 'active' ? 'text-red-400' : 'text-slate-405'}`}>
                          {account.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Safe Created:</span>
                        <span className="font-mono text-[10px] flex items-center gap-1 text-slate-200">
                          <Calendar className="w-3.5 h-3.5 text-red-500" />
                          {new Date(account.creationDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {account.tags && account.tags.length > 0 && (
                    <div>
                      <span className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-widest block mb-2">Metadata Scope Tags</span>
                      <div className="flex flex-wrap gap-1.5">
                        {account.tags.map((t, idx) => (
                          <span key={idx} className="bg-[#000000] hover:bg-[#0a0506] text-red-400 text-[10px] px-2.5 py-1 rounded-full border border-red-955/35 font-mono cursor-pointer transition-colors">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons (Trash option) */}
              <div className="flex gap-4 justify-between pt-5 border-t border-red-955/20 items-center">
                <span className="text-[10px] text-slate-500 font-mono">
                  AES-256 Symmetric Cipher Standard
                </span>
                <button
                  id="btn-trash-account"
                  onClick={() => {
                    if (confirm('Move this login account and passwords to secure trash bin?')) {
                      onDelete(account.id);
                    }
                  }}
                  className="px-4 py-2 bg-red-950/15 hover:bg-red-950/25 text-red-500 hover:text-red-400 text-xs font-extrabold rounded-xl border border-red-900/30 flex items-center gap-2 transition-all cursor-pointer shadow"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Discard Account
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
