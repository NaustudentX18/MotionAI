import { FileText } from 'lucide-react';

interface AiCitationBarProps {
  sourceLabel?: string;
  excerpt?: string;
}

/**
 * Grounds AI output in user content — show what the model was asked to use.
 */
export function AiCitationBar({ sourceLabel, excerpt }: AiCitationBarProps) {
  if (!sourceLabel && !excerpt) return null;

  return (
    <div className="border-t border-[#EBEBE9] bg-[#F7F6F3] px-3 py-2 dark:border-stone-700 dark:bg-stone-900/80">
      <div className="flex items-start gap-2 text-[11px] text-stone-500 dark:text-stone-400">
        <FileText size={12} className="mt-0.5 shrink-0 text-purple-500" />
        <div className="min-w-0">
          {sourceLabel && (
            <p className="font-semibold text-stone-600 dark:text-stone-300">Source: {sourceLabel}</p>
          )}
          {excerpt && (
            <p className="mt-0.5 line-clamp-2 italic opacity-90">&ldquo;{excerpt}&rdquo;</p>
          )}
        </div>
      </div>
    </div>
  );
}
