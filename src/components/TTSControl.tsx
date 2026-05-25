import React, { useState } from 'react';
import { Play, Pause, Square, Volume2, Settings, Loader2 } from 'lucide-react';
import { useTTS, type TTSProvider } from '../hooks/useTTS';

interface TTSControlProps {
  text: string;
  title?: string;
}

export function TTSControl({ text, title }: TTSControlProps) {
  const {
    isPlaying,
    isPaused,
    isBuffering,
    error,
    activeProvider,
    availableVoices,
    speak,
    stop,
    pause,
    resume,
    setProvider,
    setVoice,
    setSpeed,
    config,
  } = useTTS({ provider: 'browser' });

  const [isOpen, setIsOpen] = useState(false);

  const filteredVoices = availableVoices.filter((v) => v.provider === activeProvider);

  const handlePlayPause = () => {
    if (isPlaying) {
      if (isPaused) {
        resume();
      } else {
        pause();
      }
    } else {
      speak(text);
    }
  };

  return (
    <div className="tts-control-panel flex flex-col gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur-sm max-w-sm mt-3 w-full shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            disabled={isBuffering || !text}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white transition-colors cursor-pointer"
            title={isPlaying ? (isPaused ? 'Resume' : 'Pause') : 'Listen to content'}
            aria-label={isPlaying ? (isPaused ? 'Resume' : 'Pause') : 'Listen to content'}
          >
            {isBuffering ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isPlaying && !isPaused ? (
              <Pause size={14} fill="currentColor" />
            ) : (
              <Play size={14} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          {isPlaying && (
            <button
              onClick={stop}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
              title="Stop"
              aria-label="Stop playback"
            >
              <Square size={12} fill="currentColor" />
            </button>
          )}

          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1">
              <Volume2 size={12} className="text-gray-500" />
              {title || 'Listen to Page'}
            </span>
            <span className="text-[9px] text-gray-500 dark:text-gray-400">
              {isBuffering ? 'Loading audio...' : isPlaying ? (isPaused ? 'Paused' : 'Playing') : 'Ready'}
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer"
          title="TTS Settings"
          aria-label="Toggle settings"
        >
          <Settings size={14} />
        </button>
      </div>

      {isOpen && (
        <div className="flex flex-col gap-2 pt-2 border-t border-gray-200 dark:border-gray-800 mt-1 text-[11px] text-gray-600 dark:text-gray-300">
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-gray-500 dark:text-gray-400">Provider</label>
            <select
              value={activeProvider}
              onChange={(e) => setProvider(e.target.value as TTSProvider)}
              className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded px-2 py-1 text-[11px] text-gray-700 dark:text-gray-200 focus:outline-none focus:border-blue-500"
            >
              <option value="browser">Browser Native (Offline)</option>
              <option value="openai">OpenAI Cloud</option>
              <option value="local">Local API (Piper/Kokoro)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-gray-500 dark:text-gray-400">Voice</label>
            <select
              value={config.voice || ''}
              onChange={(e) => setVoice(e.target.value || undefined)}
              className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded px-2 py-1 text-[11px] text-gray-700 dark:text-gray-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">Default Voice</option>
              {filteredVoices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <label className="font-semibold text-gray-500 dark:text-gray-400">Speed</label>
              <span>{config.speed}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={config.speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="accent-blue-500 dark:accent-blue-400 h-1 rounded bg-gray-200 dark:bg-gray-700"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="text-[10px] text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded p-1.5 mt-1">
          {error}
        </div>
      )}
    </div>
  );
}
