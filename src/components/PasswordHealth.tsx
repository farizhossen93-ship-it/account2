import { useState, useEffect } from 'react';
import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { PasswordHealthSummary, Account } from '../types.js';

interface HealthProps {
  token: string | null;
  accounts: Account[];
  onSelectAccount: (acc: Account) => void;
}

export default function PasswordHealth({ token, accounts, onSelectAccount }: HealthProps) {
  const [health, setHealth] = useState<PasswordHealthSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [analysisList, setAnalysisList] = useState<Array<{
    account: Account;
    strength: 'Weak' | 'Moderate' | 'Strong';
    reused: boolean;
    old: boolean;
    reasons: string[];
  }>>([]);

  const computeLocalHealthAnalysis = async () => {
    setLoading(true);
    try {
      const statsResp = await fetch('/api/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await statsResp.json();
      if (statsResp.ok) {
        setHealth(data.health);
      }

      const processed: typeof analysisList = [];

      for (const a of accounts) {
        const reasons: string[] = [];
        let strength: 'Weak' | 'Moderate' | 'Strong' = 'Strong';
        
        const ageMs = Date.now() - new Date(a.creationDate).getTime();
        const ageDays = ageMs / (1000 * 3600 * 24);
        const isOld = ageDays > 90;
        if (isOld) reasons.push('Key age exceeds 90 days (Rotate suggested)');

        const isCryptedWeak = a.passwordEncrypted.length < 45;
        if (isCryptedWeak) {
          strength = 'Weak';
          reasons.push('Vulnerable length detected in storage cipher');
        } else {
          strength = 'Strong';
        }

        const hasReusedGuess = accounts.some(other => other.id !== a.id && other.username === a.username && other.category === a.category);
        if (hasReusedGuess) {
          reasons.push('Possible credential stuffing overlap identified');
        }

        processed.push({
          account: a,
          strength,
          reused: hasReusedGuess,
          old: isOld,
          reasons
        });
      }

      setAnalysisList(processed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    computeLocalHealthAnalysis();
  }, [token, accounts]);

  if (loading || !health) {
    return (
      <div className="flex justify-center items-center py-20" id="health-loading">
        <Loader2 className="w-8 h-8 text-red-550 animate-spin" />
      </div>
    );
  }

  const getScoreDescription = (score: number) => {
    if (score >= 85) return { text: 'Excellent Defense Status', sub: 'Your credential configuration meets system recommendations.', icon: ShieldCheck, color: 'text-red-400' };
    if (score >= 60) return { text: 'Moderate Risk Warning', sub: 'Identify and resolve credential duplicate issues to improve safety.', icon: Shield, color: 'text-red-500/80' };
    return { text: 'Compromised Perimeter Risk', sub: 'Urget: rotate weak and overlapping keys immediately to block automated attacks.', icon: ShieldAlert, color: 'text-red-600' };
  };

  const scoreDetails = getScoreDescription(health.securityScore);
  const ScoreIcon = scoreDetails.icon;

  return (
    <div className="space-y-6" id="health-module-wrapper">
      
      {/* Visual Diagnostic Banner */}
      <div className="bg-[#050505] border border-red-950/45 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 text-left shadow-lg animate-fade-in crimson-glow">
        <div className="shrink-0 flex items-center justify-center relative w-24 h-24">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="48" cy="48" r="42" className="stroke-red-950/20 fill-none" strokeWidth="8" />
            <circle 
              cx="48" 
              cy="48" 
              r="42" 
              className="fill-none transition-all duration-1000 stroke-red-655"
              strokeWidth="8.5" 
              strokeDasharray={264}
              strokeDashoffset={264 - (264 * health.securityScore) / 100}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col justify-center items-center">
            <span className="text-2xl font-black font-mono text-slate-100">{health.securityScore}</span>
            <span className="text-[8px] text-red-555 font-bold uppercase font-sans">Health Score</span>
          </div>
        </div>

        <div className="space-y-1.5 flex-1">
          <h3 className={`text-md font-bold font-display flex items-center gap-1.5 ${scoreDetails.color}`}>
            <ScoreIcon className="w-5 h-5 animate-pulse" />
            {scoreDetails.text}
          </h3>
          <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
            {scoreDetails.sub} Integrity health score measures password repetition, length, entropy characteristics, and key age indices. Keep metrics above 85% to maximize personal defence.
          </p>

          <div className="flex gap-4 pt-1 flex-wrap">
            <span className="text-[10px] bg-red-950/20 text-red-400 border border-red-900/30 px-2.5 py-0.5 rounded-full font-mono">
              Weak: {health.weakCount}
            </span>
            <span className="text-[10px] bg-red-950/20 text-red-500 border border-red-900/30 px-2.5 py-0.5 rounded-full font-mono">
              Reused: {health.reusedCount}
            </span>
            <span className="text-[10px] bg-[#000000] text-slate-400 border border-red-950 px-2.5 py-0.5 rounded-full font-mono">
              Outdated: {health.oldCount}
            </span>
          </div>
        </div>

        <button
          onClick={computeLocalHealthAnalysis}
          className="p-2 border border-red-950 hover:border-red-900 text-red-505 hover:text-red-400 bg-[#000000] rounded-xl flex items-center gap-1 cursor-pointer text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Audit Checklist Table */}
      <div className="bg-[#050505] border border-red-950/45 rounded-3xl overflow-hidden text-left shadow-lg crimson-glow" id="vulnerable-list-pane">
        <div className="p-5 bg-red-950/10 border-b border-red-955/20 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 text-left animate-pulse" />
          <h4 className="text-xs font-mono font-bold text-red-400 uppercase tracking-widest leading-none font-display">Symmetric Security Audit Checklist</h4>
        </div>

        <div className="divide-y divide-red-955/20">
          {analysisList.filter(row => row.reasons.length > 0).length === 0 ? (
            <div className="p-8 text-center space-y-2 bg-[#050505]">
              <ShieldCheck className="w-10 h-10 text-red-500 mx-auto" />
              <h5 className="text-xs font-bold text-slate-200 font-display">No Security Vulnerabilities Detected</h5>
              <p className="text-[10px] text-slate-500 max-w-sm mx-auto">All safe login structures use highly randomized credentials and retain unique passwords.</p>
            </div>
          ) : (
            analysisList.filter(row => row.reasons.length > 0).map(row => (
              <div 
                key={row.account.id} 
                onClick={() => onSelectAccount(row.account)}
                className="p-4 hover:bg-[#0a0506]/50 transition-all cursor-pointer flex items-center justify-between gap-4 font-sans"
              >
                <div className="space-y-1.5 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200 font-display">{row.account.title}</span>
                    <span className="text-[8px] bg-red-950/20 text-red-400 px-2 py-0.5 rounded-full font-mono border border-red-900/20">
                      {row.account.category}
                    </span>
                  </div>

                  <div className="space-y-1 text-left font-sans">
                    {row.reasons.map((r, i) => (
                      <span key={i} className="text-[10px] text-red-400 flex items-center gap-1 font-sans font-medium">
                        <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 text-red-500 hover:text-red-400 text-xs font-semibold font-sans">
                  <span>Re-Key Vault</span>
                  <ArrowRight className="w-3.5 h-3.5 text-red-500 font-bold" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
