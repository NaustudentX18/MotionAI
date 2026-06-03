import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'min-h-11 w-full rounded-[var(--motion-radius-md)] border border-[var(--motion-border)]',
        'bg-[var(--motion-surface-base)] px-3 text-sm text-[var(--motion-text)]',
        'placeholder:text-[var(--motion-text-muted)]',
        'transition-[border-color,box-shadow] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-out)]',
        'focus-visible:outline-none focus-visible:border-[var(--motion-accent)] focus-visible:ring-2 focus-visible:ring-[var(--motion-accent-muted)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
