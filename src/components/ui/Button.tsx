import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const variantStyles = {
  primary:
    'bg-[var(--motion-accent)] text-white hover:opacity-90 active:opacity-95 shadow-xs',
  secondary:
    'border border-[var(--motion-border)] bg-[var(--motion-surface-raised)] text-[var(--motion-text)] hover:bg-[var(--motion-surface-hover)]',
  ghost:
    'bg-transparent text-[var(--motion-accent)] hover:bg-[var(--motion-accent-muted)]',
} as const;

export type ButtonVariant = keyof typeof variantStyles;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--motion-radius-md)] px-4 text-sm font-semibold',
        'transition-opacity duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-out)]',
        'disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--motion-accent)] focus-visible:ring-offset-2',
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
