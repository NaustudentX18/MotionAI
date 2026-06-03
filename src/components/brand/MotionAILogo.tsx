import { cn } from '../../lib/utils';

export type MotionAILogoVariant = 'mark' | 'wordmark';
export type MotionAILogoTheme = 'color' | 'mono-light' | 'mono-dark';

export interface MotionAILogoProps {
  /** Width in px (height follows aspect ratio). */
  size?: number;
  variant?: MotionAILogoVariant;
  theme?: MotionAILogoTheme;
  className?: string;
  title?: string;
}

const MARK_PATH = '/brand/motionai-mark.svg';
const WORDMARK_PATH = '/brand/motionai-wordmark.svg';

/**
 * MotionAI Flux mark — gradient squircle, kinetic M, orbital spark.
 */
export function MotionAILogo({
  size = 32,
  variant = 'mark',
  theme = 'color',
  className,
  title = 'MotionAI',
}: MotionAILogoProps) {
  const src = variant === 'wordmark' ? WORDMARK_PATH : MARK_PATH;
  const aspect = variant === 'wordmark' ? 360 / 80 : 1;
  const width = size;
  const height = Math.round(size / aspect);

  if (theme === 'color') {
    return (
      <img
        src={src}
        alt={title}
        width={width}
        height={height}
        className={cn('shrink-0 select-none', className)}
        draggable={false}
      />
    );
  }

  return (
    <InlineFluxMark
      size={size}
      variant={variant}
      theme={theme}
      className={className}
      title={title}
    />
  );
}

function InlineFluxMark({
  size,
  variant,
  theme,
  className,
  title,
}: {
  size: number;
  variant: MotionAILogoVariant;
  theme: 'mono-light' | 'mono-dark';
  className?: string;
  title: string;
}) {
  const fg = theme === 'mono-light' ? '#ffffff' : '#18181b';
  const bg = theme === 'mono-light' ? '#27272a' : '#f4f4f5';
  const accent = theme === 'mono-light' ? '#a5f3fc' : '#7c3aed';
  const showWordmark = variant === 'wordmark';
  const markSize = showWordmark ? Math.round(size * 0.72) : size;

  return (
    <span
      className={cn('inline-flex items-center gap-2 shrink-0', className)}
      role="img"
      aria-label={title}
    >
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 128 128"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <rect x="4" y="4" width="120" height="120" rx="28" fill={bg} />
        <path
          d="M 78 26 A 42 42 0 0 1 108 58"
          fill="none"
          stroke={fg}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.35"
        />
        <circle cx="108" cy="58" r="3.5" fill={accent} />
        <path
          fill={fg}
          d="M 30 94 V 38 L 52 66 L 64 50 L 76 66 L 98 38 V 94 H 88 V 54 L 64 78 L 40 54 V 94 Z"
        />
        <path
          fill={accent}
          d="M 64 24 L 66.2 30.8 L 73 33 L 66.2 35.2 L 64 42 L 61.8 35.2 L 55 33 L 61.8 30.8 Z"
        />
      </svg>
      {showWordmark ? (
        <span
          className="font-bold tracking-tight leading-none"
          style={{ fontSize: Math.round(size * 0.42), color: fg }}
        >
          Motion<span style={{ color: accent }}>AI</span>
        </span>
      ) : null}
    </span>
  );
}
