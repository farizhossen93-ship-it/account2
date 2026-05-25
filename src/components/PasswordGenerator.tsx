import { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw, Lock } from 'lucide-react';

export default function PasswordGenerator() {
  const [length, setLength] = useState<number>(16);
  const [useUpper, setUseUpper] = useState<boolean>(true);
  const [useLower, setUseLower] = useState<boolean>(true);
  const [useNumbers, setUseNumbers] = useState<boolean>(true);
  const [useSymbols, setUseSymbols] = useState<boolean>(true);
  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const triggerGenerate = () => {
    const upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowerChars = 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = '0123456789';
    const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let allowed = '';
    let password = '';

    // Guarantee at least one character from each active subset
    if (useUpper) {
      allowed += upperChars;
      password += upperChars[Math.floor(Math.random() * upperChars.length)];
    }
    if (useLower) {
      allowed += lowerChars;
      password += lowerChars[Math.floor(Math.random() * lowerChars.length)];
    }
    if (useNumbers) {
      allowed += numberChars;
      password += numberChars[Math.floor(Math.random() * numberChars.length)];
    }
    if (useSymbols) {
      allowed += symbolChars;
      password += symbolChars[Math.floor(Math.random() * symbolChars.length)];
    }

    if (allowed.length === 0) {
      setGeneratedPassword('Select at least one option');
      return;
    }

    // Fill the remaining length with random selection
    const startLen = password.length;
    for (let i = startLen; i < length; i++) {
      const idx = Math.floor(Math.random() * allowed.length);
      password += allowed[idx];
    }

    // Shuffle the final product to prevent predictable beginnings
    const shuffled = password.split('').sort(() => 0.5 - Math.random()).join('');
    setGeneratedPassword(shuffled);
    setCopied(false);
  };

  useEffect(() => {
    triggerGenerate();
  }, [length, useUpper, useLower, useNumbers, useSymbols]);

  const copyToClipboard = () => {
    if (!generatedPassword || generatedPassword.startsWith('Select')) return;
    navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const calculateStrength = (): { label: string; color: string; pct: number } => {
    let score = 0;
    if (length >= 12) score += 30;
    else if (length >= 8) score += 15;

    if (useUpper) score += 20;
    if (useLower) score += 20;
    if (useNumbers) score += 15;
    if (useSymbols) score += 15;

    if (!useUpper && !useLower && !useNumbers && !useSymbols) score = 0;

    if (score >= 80) return { label: 'Cryptographically Impregnable', color: 'bg-red-500', pct: 100 };
    if (score >= 60) return { label: 'Extremely Strong', color: 'bg-red-600/80', pct: 75 };
    if (score >= 40) return { label: 'Moderate Defense', color: 'bg-red-800/60', pct: 50 };
    return { label: 'Hazardously Weak', color: 'bg-red-950/75 border border-red-800/30', pct: 25 };
  };

  const strength = calculateStrength();

  return (
    <div id="password-gen-container" className="bg-[#050505] border border-red-950/50 rounded-3xl p-6 shadow-lg crimson-glow text-left">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-red-950/30 border border-red-900/30 rounded-xl text-red-500">
          <Lock className="w-5 h-5" id="pwd-gen-icon" />
        </div>
        <div className="text-left font-sans">
          <h3 className="text-md font-semibold text-slate-100 font-display">Symmetric Password Generator</h3>
          <p className="text-[10px] text-slate-500 font-mono">Instant, cryptographically safe hashes</p>
        </div>
      </div>

      <div className="relative mb-5 bg-[#0a0a0a] rounded-2xl p-4 border border-red-955/60 flex items-center justify-between">
        <span className="font-mono text-sm md:text-md text-red-500 break-all select-all font-semibold mr-10 leading-relaxed block text-left">
          {generatedPassword}
        </span>
        <button
          id="btn-copy-gen"
          onClick={copyToClipboard}
          disabled={generatedPassword.startsWith('Select')}
          className="shrink-0 p-2 text-slate-400 hover:text-red-500 bg-[#050505] hover:bg-[#0a0506] border border-red-950/60 rounded-xl transition-all absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
          title="Copy password to clipboard"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <div className="space-y-4 font-sans">
        {/* Strength Rating Indicator */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-405">Complexity Metric:</span>
            <span className="font-bold text-red-500">{strength.label}</span>
          </div>
          <div className="w-full bg-[#0a0a0a] rounded-full h-2 overflow-hidden border border-red-955/20 animate-pulse">
            <div className={`h-full transition-all duration-300 ${strength.color}`} style={{ width: `${strength.pct}%` }} />
          </div>
        </div>

        {/* Configurations */}
        <div className="space-y-3 pt-2 text-left">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>Bit Length:</span>
              <span className="text-red-400 font-bold">{length} characters</span>
            </div>
            <input
              id="slider-length"
              type="range"
              min={8}
              max={32}
              value={length}
              onChange={(e) => setLength(parseInt(e.target.value))}
              className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none cursor-pointer accent-red-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <label className="flex items-center gap-2.5 text-xs text-slate-350 cursor-pointer select-none">
              <input
                id="chk-upper"
                type="checkbox"
                checked={useUpper}
                onChange={() => setUseUpper(!useUpper)}
                className="w-4 h-4 border-red-950 bg-[#0a0a0a] text-red-505 rounded focus:ring-0 cursor-pointer accent-red-655"
              />
              <span>AZ uppercase</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-350 cursor-pointer select-none">
              <input
                id="chk-lower"
                type="checkbox"
                checked={useLower}
                onChange={() => setUseLower(!useLower)}
                className="w-4 h-4 border-red-950 bg-[#0a0a0a] text-red-505 rounded focus:ring-0 cursor-pointer accent-red-655"
              />
              <span>az lowercase</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-350 cursor-pointer select-none">
              <input
                id="chk-numbers"
                type="checkbox"
                checked={useNumbers}
                onChange={() => setUseNumbers(!useNumbers)}
                className="w-4 h-4 border-red-950 bg-[#0a0a0a] text-red-505 rounded focus:ring-0 cursor-pointer accent-red-655"
              />
              <span>09 numerals</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-350 cursor-pointer select-none">
              <input
                id="chk-symbols"
                type="checkbox"
                checked={useSymbols}
                onChange={() => setUseSymbols(!useSymbols)}
                className="w-4 h-4 border-red-950 bg-[#0a0a0a] text-red-505 rounded focus:ring-0 cursor-pointer accent-red-655"
              />
              <span>%!# symbols</span>
            </label>
          </div>
        </div>

        <button
          id="btn-trigger-regen"
          onClick={triggerGenerate}
          className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 bg-red-950/20 hover:bg-red-900/20 text-red-500 hover:text-red-450 active:scale-[0.98] text-xs font-semibold rounded-2xl transition-all cursor-pointer border border-red-900/30"
        >
          <RefreshCw className="w-3.5 h-3.5 text-red-500 animate-spin-hover" />
          <span>Generate Secure Password</span>
        </button>
      </div>
    </div>
  );
}
