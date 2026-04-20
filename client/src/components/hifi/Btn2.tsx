import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-a-500 text-white hover:bg-a-600 active:bg-a-700 shadow-sh1',
  secondary:
    'bg-white text-n-800 border border-n-200 hover:bg-n-75 active:bg-n-100',
  ghost: 'bg-transparent text-n-700 hover:bg-n-100',
  danger: 'bg-bad text-white hover:brightness-95',
};

interface Btn2Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Btn2 = forwardRef<HTMLButtonElement, Btn2Props>(
  (
    { variant = 'primary', leading, trailing, children, className = '', ...rest },
    ref,
  ) => (
    <button
      ref={ref}
      className={[
        'inline-flex items-center justify-center gap-1.5 text-[12.5px] font-medium rounded-r2 px-3 h-8 transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </button>
  ),
);
Btn2.displayName = 'Btn2';
