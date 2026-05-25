import { useState, useCallback } from 'react';
import { getPinLockoutMs, registerFailedPin, verifyPin, unlock } from '../lib/localAuth';
import { Lock } from 'lucide-react';

interface LockScreenProps {
  onUnlocked: () => void;
}

const DIGITS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export function LockScreen({ onUnlocked }: LockScreenProps) {
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleDigit = useCallback((d: string) => {
    if (checking) return;
    setError('');
    if (d === '⌫') {
      setInput((p) => p.slice(0, -1));
      return;
    }
    if (d === '') return;
    const next = input + d;
    setInput(next);

    // Auto-submit at 6 digits
    if (next.length === 6) {
      submit(next);
    }
  }, [input, checking]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useCallback(async (pin: string) => {
    const lockoutMs = getPinLockoutMs();
    if (lockoutMs > 0) {
      setError(`Too many attempts. Try again in ${Math.ceil(lockoutMs / 1000)}s.`);
      setInput('');
      return;
    }

    setChecking(true);
    const ok = await verifyPin(pin);
    if (ok) {
      unlock();
      onUnlocked();
    } else {
      const nextLockoutMs = registerFailedPin();
      setShake(true);
      setError(nextLockoutMs > 0 ? 'Too many attempts. Locked for 60s.' : 'Incorrect PIN');
      setInput('');
      setTimeout(() => setShake(false), 600);
    }
    setChecking(false);
  }, [onUnlocked]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#09090B]/95 backdrop-blur-md">
      {/* Glow accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      {/* Card */}
      <div className={`relative flex flex-col items-center gap-6 px-10 py-10 rounded-2xl bg-white/5 border border-white/10 shadow-2xl transition-transform ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
        style={{ minWidth: 320 }}>

        {/* Icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-indigo-500/20 border border-indigo-500/30">
          <Lock size={26} className="text-indigo-400" />
        </div>

        <div className="text-center">
          <h1 className="text-xl font-semibold text-white tracking-tight">MotionAI Locked</h1>
          <p className="text-sm text-stone-400 mt-1">Enter your PIN to continue</p>
        </div>

        {/* PIN dots */}
        <div className="flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full border-2 transition-all duration-150 ${
                i < input.length
                  ? 'bg-indigo-400 border-indigo-400 scale-110'
                  : 'bg-transparent border-stone-600'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        <div className={`text-xs text-red-400 h-4 transition-opacity ${error ? 'opacity-100' : 'opacity-0'}`}>
          {error || ' '}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3">
          {DIGITS.map((d, i) => (
            <button
              key={i}
              onClick={() => handleDigit(d)}
              disabled={d === '' || checking}
              className={`
                flex items-center justify-center w-16 h-16 rounded-xl text-lg font-medium
                transition-all duration-100 select-none
                ${d === ''
                  ? 'invisible'
                  : 'bg-white/8 hover:bg-white/15 active:scale-95 active:bg-indigo-500/30 text-white border border-white/8 hover:border-white/20 cursor-pointer shadow-sm'
                }
                ${checking ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Shake keyframe injected globally */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}
