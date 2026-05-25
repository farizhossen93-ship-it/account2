import { Shield, Key, AlertTriangle, Database, DollarSign, Loader2, ArrowUpRight } from 'lucide-react';
import { DashboardStats, PasswordHealthSummary } from '../types.js';

interface StatsProps {
  stats: DashboardStats | null;
  health: PasswordHealthSummary | null;
  loading: boolean;
  onNavigateToCategory: (cat: string) => void;
  onNavigateToHealth: () => void;
}

export default function DashboardStatsCards({ stats, health, loading, onNavigateToCategory, onNavigateToHealth }: StatsProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" id="stats-loading-box">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#050505] border border-red-950/20 animate-pulse h-28 rounded-2xl flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-red-900 animate-spin" />
          </div>
        ))}
      </div>
    );
  }

  const formatBalance = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-400 font-extrabold';
    if (score >= 55) return 'text-red-500/80';
    return 'text-red-600/70';
  };

  return (
    <div className="space-y-6 mb-8" id="dashboard-statistics-section">
      {/* 4 Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Accounts */}
        <div 
          onClick={() => onNavigateToCategory('All')}
          id="stat-card-total"
          className="bg-[#050505] hover:bg-[#0a0506] border border-red-950/50 hover:border-red-900/60 hover:shadow-lg rounded-3xl p-6 flex items-center justify-between transition-all cursor-pointer group crimson-glow"
        >
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-medium font-sans">Total Credentials</span>
            <h4 className="text-3xl font-extrabold text-[#f1f5f9] font-display tracking-tight">
              {stats.totalAccounts}
            </h4>
            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
              <span>Saved:</span>
              <span className="text-red-500 font-semibold">{stats.totalSavedPasswords}</span>
            </span>
          </div>
          <div className="p-3 bg-red-950/30 text-red-500 rounded-2xl group-hover:scale-110 transition-transform border border-red-900/20">
            <Key className="w-5 h-5" id="total-keys-icon" />
          </div>
        </div>

        {/* Gmail accounts */}
        <div 
          onClick={() => onNavigateToCategory('Gmail')}
          id="stat-card-gmail"
          className="bg-[#050505] hover:bg-[#0a0506] border border-red-950/50 hover:border-red-900/60 hover:shadow-lg rounded-3xl p-6 flex items-center justify-between transition-all cursor-pointer group crimson-glow"
        >
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-medium font-sans">Verified Gmails</span>
            <h4 className="text-3xl font-extrabold text-[#f1f5f9] font-display tracking-tight">
              {stats.totalGmailAccounts}
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">
              Google Workspace
            </span>
          </div>
          <div className="p-3 bg-red-950/30 text-red-400 rounded-2xl group-hover:scale-110 transition-transform border border-red-900/20">
            <Database className="w-5 h-5" id="gmail-keys-icon" />
          </div>
        </div>

        {/* Crypto Wallets */}
        <div 
          onClick={() => onNavigateToCategory('Crypto')}
          id="stat-card-crypto"
          className="bg-[#050505] hover:bg-[#0a0506] border border-red-950/50 hover:border-red-900/60 hover:shadow-lg rounded-3xl p-6 flex items-center justify-between transition-all cursor-pointer group crimson-glow"
        >
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-medium font-sans">Crypto Accounts</span>
            <h4 className="text-3xl font-extrabold text-[#f1f5f9] font-display tracking-tight">
              {stats.totalCryptoAccounts}
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">
              Symmetric Seed Keys
            </span>
          </div>
          <div className="p-3 bg-red-950/30 text-red-500 rounded-2xl group-hover:scale-110 transition-transform border border-red-900/20">
            <Shield className="w-5 h-5" id="crypto-keys-icon" />
          </div>
        </div>

        {/* Balance Tracker */}
        <div 
          onClick={() => onNavigateToCategory('All')} 
          id="stat-card-balance"
          className="bg-[#050505] hover:bg-[#0a0506] border border-red-950/50 hover:border-red-900/60 hover:shadow-lg rounded-3xl p-6 flex items-center justify-between transition-all cursor-pointer group crimson-glow"
        >
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-medium font-sans">Balanced Ledger</span>
            <h4 className="text-2xl font-bold text-red-500 font-mono tracking-tight">
              {formatBalance(stats.totalBalanceUSD)}
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">
              Consolidated Fiat (USD)
            </span>
          </div>
          <div className="p-3 bg-red-950/30 text-red-500 rounded-2xl group-hover:scale-110 transition-transform border border-red-900/20">
            <DollarSign className="w-5 h-5" id="balance-keys-icon" />
          </div>
        </div>
      </div>

      {/* Security Health Spotlight Banner */}
      {health && (
        <div 
          onClick={onNavigateToHealth}
          id="security-banner"
          className="bg-gradient-to-br from-[#0c0304] to-[#020202] border border-red-950/50 hover:border-red-900/60 hover:shadow-xl rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 cursor-pointer group transition-all crimson-glow"
        >
          <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
            <div className="relative shrink-0 flex items-center justify-center">
              {/* Radial Score Gauge */}
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="28" className="stroke-red-950/20 fill-none" strokeWidth="5" />
                <circle 
                  cx="32" 
                  cy="32" 
                  r="28" 
                  className={`fill-none transition-all duration-1000 stroke-red-650`}
                  strokeWidth="5.5" 
                  strokeDasharray={176}
                  strokeDashoffset={176 - (176 * health.securityScore) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <span className={`absolute font-mono text-sm font-extrabold text-red-500`}>
                {health.securityScore}%
              </span>
            </div>

            <div className="space-y-1 text-left">
              <h5 className="text-sm font-semibold text-slate-200 flex items-center justify-center md:justify-start gap-1.5 font-display">
                <span>Vault Security Health Integrity</span>
                <span className="text-[10px] py-0.5 px-2 bg-[#000000] text-red-500 rounded-full font-mono border border-red-950/60">
                  AES-256 GCM
                </span>
              </h5>
              <p className="text-xs text-slate-400 max-w-xl">
                Your account password strength is evaluated locally. Keep credentials unique and rotate master keys consistently to preserve digital ownership.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0 mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-red-950/25 w-full md:w-auto justify-around md:justify-end">
            <div className="text-center md:text-right">
              <span className="text-[10px] text-slate-500 font-mono block">Weak Hashes</span>
              <span className={`text-sm font-bold font-mono ${health.weakCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {health.weakCount}
              </span>
            </div>
            <div className="text-center md:text-right">
              <span className="text-[10px] text-slate-500 font-mono block">Reused Hashes</span>
              <span className={`text-sm font-bold font-mono ${health.reusedCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                {health.reusedCount}
              </span>
            </div>
            <div className="text-center md:text-right">
              <span className="text-[10px] text-slate-500 font-mono block">Expired (&gt;90d)</span>
              <span className="text-sm font-bold font-mono text-slate-400">
                {health.oldCount}
              </span>
            </div>
            <div className="p-2 bg-[#000000] group-hover:bg-red-950/20 rounded-xl text-red-500 group-hover:translate-x-0.5 transition-all hidden md:block border border-red-950/60">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
