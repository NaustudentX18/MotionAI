import { FileText, ExternalLink } from 'lucide-react';

export interface AiCitationSource {
  pageId?: string;
  blockId?: string;
  label: string;
  excerpt?: string;
}

interface AiCitationBarProps {
  sourceLabel?: string;
  excerpt?: string;
  sources?: AiCitationSource[];
  onNavigate?: (pageId: string, blockId?: string) => void;
}

export function AiCitationBar({ sourceLabel, excerpt, sources, onNavigate }: AiCitationBarProps) {
  const list =
    sources && sources.length > 0
      ? sources
      : sourceLabel
        ? [{ label: sourceLabel, excerpt }]
        : [];

  if (list.length === 0 && !excerpt) return null;

  return (
    <div className="border-t border-[#EBEBE9] bg-[#F7F6F3] px-3 py-2 dark:border-stone-700 dark:bg-stone-900/80">
      <div className="flex items-start gap-2 text-[11px] text-stone-500 dark:text-stone-400">
        <FileText size={12} className="mt-0.5 shrink-0 text-purple-500" />
        <div className="min-w-0 flex-1 space-y-1">
          {list.map((s, i) => (
            <div key={`${s.label}-${i}`}>
              {s.pageId && onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate(s.pageId!, s.blockId)}
                  className="inline-flex items-center gap-1 font-semibold text-purple-600 hover:underline dark:text-purple-400"
                >
                  {s.label}
                  <ExternalLink size={10} />
                </button>
              ) : (
                <p className="font-semibold text-stone-600 dark:text-stone-300">Source: {s.label}</p>
              )}
              {(s.excerpt || (i === 0 && excerpt)) && (
                <p className="mt-0.5 line-clamp-2 italic opacity-90">
                  &ldquo;{s.excerpt || excerpt}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
