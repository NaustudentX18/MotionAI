import { useEffect, useState } from 'react';
import { Mic, X } from 'lucide-react';
import { isStandalonePwa, requestMicrophonePermission } from '../lib/device';
import { useToast } from './ToastProvider';

const DISMISS_KEY = 'motionai-pwa-capabilities-dismissed';

export function PwaCapabilityBanner() {
  const { showToast } = useToast();
  const [visible, setVisible] = useState(false);
  const [micState, setMicState] = useState<PermissionState | 'unsupported' | 'unknown'>('unknown');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;
    if (!isStandalonePwa() && !/iPhone|iPad|Android/i.test(navigator.userAgent)) return;

    setVisible(true);

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then(status => {
          setMicState(status.state);
          status.onchange = () => setMicState(status.state);
        })
        .catch(() => setMicState('unknown'));
    }
  }, []);

  if (!visible) return null;

  const enableMic = async () => {
    const result = await requestMicrophonePermission();
    setMicState(result === 'unsupported' ? 'unsupported' : result);
    if (result === 'granted') {
      showToast('Microphone enabled for voice notes and meeting capture.', 'success');
    } else if (result === 'denied') {
      showToast('Microphone blocked. Enable it in browser Settings → MotionAI.', 'error');
    } else {
      showToast('Microphone is not available in this browser.', 'error');
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  return (
    <div
      className="fixed inset-x-3 z-[120] rounded-2xl border border-purple-500/30 bg-stone-900/95 p-4 text-stone-100 shadow-2xl backdrop-blur-md"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      role="region"
      aria-label="App permissions"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-bold text-white">Home screen app ready</p>
          <p className="text-xs leading-relaxed text-stone-400">
            Enable the microphone for AI chat dictation and meeting notes. Audio plays through your device speakers automatically.
          </p>
          {micState === 'granted' && (
            <p className="text-xs font-medium text-emerald-400">Microphone access granted</p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-11 min-w-11 shrink-0 rounded-full text-stone-400 hover:bg-stone-800 hover:text-stone-200"
          aria-label="Dismiss"
        >
          <X size={18} className="mx-auto" />
        </button>
      </div>
      {micState !== 'granted' && (
        <button
          type="button"
          onClick={enableMic}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-purple-600 text-sm font-semibold text-white hover:bg-purple-500"
        >
          <Mic size={16} />
          Enable microphone
        </button>
      )}
    </div>
  );
}
