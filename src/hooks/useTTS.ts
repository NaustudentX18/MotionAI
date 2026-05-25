import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from './useSettings';

export type TTSProvider = 'browser' | 'local' | 'openai';

// Simple IndexedDB cache for TTS audio blobs
const DB_NAME = 'motionai_tts_cache';
const STORE_NAME = 'audio_blobs';
const DB_VERSION = 1;

function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function getCachedAudio(key: string): Promise<Blob | null> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch (err) {
    console.warn('TTS Cache Read Error:', err);
    return null;
  }
}

async function setCachedAudio(key: string, blob: Blob): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(blob, key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.warn('TTS Cache Write Error:', err);
  }
}

function generateCacheKey(text: string, provider: string, voice: string, speed: number): string {
  const str = `${text}_${provider}_${voice}_${speed}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `tts_${hash}`;
}

export interface TTSConfig {
  provider: TTSProvider;
  voice?: string;
  speed?: number;
  localEndpointUrl?: string;
  openaiModel?: string;
}

export interface TTSVoice {
  id: string;
  name: string;
  lang: string;
  provider: TTSProvider;
}

export interface UseTTSResult {
  isPlaying: boolean;
  isPaused: boolean;
  isBuffering: boolean;
  error: string | null;
  activeProvider: TTSProvider;
  availableVoices: TTSVoice[];
  speak: (text: string, overrideConfig?: Partial<TTSConfig>) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  setProvider: (provider: TTSProvider) => void;
  setVoice: (voiceId?: string) => void;
  setSpeed: (speed: number) => void;
  config: TTSConfig;
}

const OPENAI_VOICES: TTSVoice[] = [
  { id: 'alloy', name: 'Alloy (OpenAI)', lang: 'en', provider: 'openai' },
  { id: 'echo', name: 'Echo (OpenAI)', lang: 'en', provider: 'openai' },
  { id: 'fable', name: 'Fable (OpenAI)', lang: 'en', provider: 'openai' },
  { id: 'onyx', name: 'Onyx (OpenAI)', lang: 'en', provider: 'openai' },
  { id: 'nova', name: 'Nova (OpenAI)', lang: 'en', provider: 'openai' },
  { id: 'shimmer', name: 'Shimmer (OpenAI)', lang: 'en', provider: 'openai' },
];

const LOCAL_VOICES: TTSVoice[] = [
  { id: 'en-us', name: 'Default US (Local)', lang: 'en-US', provider: 'local' },
  { id: 'en-gb', name: 'Default GB (Local)', lang: 'en-GB', provider: 'local' },
  { id: 'af_bella', name: 'Bella (Kokoro)', lang: 'en', provider: 'local' },
  { id: 'af_nicole', name: 'Nicole (Kokoro)', lang: 'en', provider: 'local' },
  { id: 'am_adam', name: 'Adam (Kokoro)', lang: 'en', provider: 'local' },
];

export function useTTS(initialConfig?: Partial<TTSConfig>): UseTTSResult {
  const { settings } = useSettings();

  // Dynamically determine provider based on setting's active provider
  const getInitialProvider = (): TTSProvider => {
    if (initialConfig?.provider) return initialConfig.provider;
    const active = settings.activeProvider;
    if (active === 'openai-compatible') return 'openai';
    if (active === 'ollama' || active === 'lmstudio' || active === 'vllm') return 'local';
    return 'browser';
  };

  const [config, setConfig] = useState<TTSConfig>({
    provider: getInitialProvider(),
    speed: 1.0,
    ...initialConfig,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserVoices, setBrowserVoices] = useState<TTSVoice[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load browser speechSynthesis voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const updateVoices = () => {
      const synVoices = window.speechSynthesis.getVoices();
      const mapped = synVoices.map((v) => ({
        id: v.name,
        name: `${v.name} (${v.lang})`,
        lang: v.lang,
        provider: 'browser' as const,
      }));
      setBrowserVoices(mapped);
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const availableVoices = [...browserVoices, ...LOCAL_VOICES, ...OPENAI_VOICES];

  const stop = useCallback(() => {
    setError(null);
    setIsPlaying(false);
    setIsPaused(false);
    setIsBuffering(false);

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    if (config.provider === 'browser') {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    } else {
      if (audioRef.current && isPlaying) {
        audioRef.current.pause();
        setIsPaused(true);
      }
    }
  }, [config.provider, isPlaying]);

  const resume = useCallback(() => {
    if (config.provider === 'browser') {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      }
    } else {
      if (audioRef.current && isPaused) {
        audioRef.current.play().catch((err) => {
          setError(err instanceof Error ? err.message : 'Playback failed');
        });
        setIsPaused(false);
      }
    }
  }, [config.provider, isPaused]);

  const speak = useCallback(
    async (text: string, overrideConfig?: Partial<TTSConfig>) => {
      stop();
      setError(null);

      const activeConfig = { ...config, ...overrideConfig };
      const { provider, voice, speed, localEndpointUrl, openaiModel } = activeConfig;

      if (!text.trim()) return;

      if (provider === 'browser') {
        if (typeof window === 'undefined' || !window.speechSynthesis) {
          setError('Browser speech synthesis is not supported on this device.');
          return;
        }

        setIsPlaying(true);
        const utterance = new SpeechSynthesisUtterance(text);
        currentUtteranceRef.current = utterance;

        if (voice) {
          const sysVoices = window.speechSynthesis.getVoices();
          const matchedVoice = sysVoices.find((v) => v.name === voice);
          if (matchedVoice) {
            utterance.voice = matchedVoice;
          }
        }

        if (speed !== undefined) {
          utterance.rate = speed;
        }

        utterance.onend = () => {
          setIsPlaying(false);
          setIsPaused(false);
          currentUtteranceRef.current = null;
        };

        utterance.onerror = (e) => {
          if (e.error !== 'interrupted') {
            setError(`Speech synthesis error: ${e.error}`);
            setIsPlaying(false);
            setIsPaused(false);
          }
        };

        window.speechSynthesis.speak(utterance);
      } else {
        setIsBuffering(true);

        const cacheKey = generateCacheKey(text, provider, voice || 'default', speed || 1.0);

        try {
          // Check local IndexedDB cache first
          const cachedBlob = await getCachedAudio(cacheKey);
          let blob: Blob;

          if (cachedBlob) {
            blob = cachedBlob;
          } else {
            // Fetch active settings config for keys and endpoints if not explicitly provided
            const activeAiSettings = settings.providers[settings.activeProvider];
            const localUrl = localEndpointUrl || activeAiSettings?.baseUrl;
            const apiKey = activeAiSettings?.apiKey;

            const response = await fetch('/api/ai/tts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text,
                provider,
                voice,
                speed,
                localEndpointUrl: localUrl,
                model: openaiModel || activeAiSettings?.model,
                ai: {
                  apiKey,
                },
              }),
            });

            if (!response.ok) {
              const errBody = await response.json().catch(() => ({}));
              throw new Error(errBody.error || `TTS proxy failed: ${response.status}`);
            }

            blob = await response.blob();
            // Cache the newly fetched audio blob
            await setCachedAudio(cacheKey, blob);
          }

          const url = URL.createObjectURL(blob);
          audioUrlRef.current = url;

          const audio = new Audio(url);
          audioRef.current = audio;

          setIsBuffering(false);
          setIsPlaying(true);

          audio.onended = () => {
            setIsPlaying(false);
            setIsPaused(false);
          };

          audio.onerror = () => {
            setError('Error playing audio stream.');
            setIsPlaying(false);
            setIsPaused(false);
          };

          await audio.play();
        } catch (err: any) {
          setError(err.message || 'Failed to fetch or play TTS audio');
          setIsPlaying(false);
          setIsPaused(false);
          setIsBuffering(false);
        }
      }
    },
    [config, stop, settings]
  );

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const setProvider = (provider: TTSProvider) => {
    setConfig((prev) => ({ ...prev, provider, voice: undefined }));
  };

  const setVoice = (voice?: string) => {
    setConfig((prev) => ({ ...prev, voice }));
  };

  const setSpeed = (speed: number) => {
    setConfig((prev) => ({ ...prev, speed }));
  };

  return {
    isPlaying,
    isPaused,
    isBuffering,
    error,
    activeProvider: config.provider,
    availableVoices,
    speak,
    stop,
    pause,
    resume,
    setProvider,
    setVoice,
    setSpeed,
    config,
  };
}
