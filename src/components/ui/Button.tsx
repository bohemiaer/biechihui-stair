import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
}

const variantClassName: Record<ButtonVariant, string> = {
  primary: 'bg-[#1A1A1A] text-white hover:bg-[#212529]',
  secondary: 'bg-[#F1F3F5] text-[#212529] border border-[#EAEAEA] hover:bg-[#E9ECEF]',
  ghost: 'bg-transparent text-[#495057] hover:bg-[#F1F3F5]',
  danger: 'bg-[#FFF5F5] text-[#C92A2A] border border-[#FFE3E3] hover:bg-[#FFE3E3]',
  icon: 'bg-transparent text-[#868E96] hover:bg-[#F1F3F5] h-9 w-9 p-0',
};

export function Button({ children, className, disabled, icon, loading, variant = 'secondary', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-[14px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variantClassName[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" /> : icon}
      {variant !== 'icon' && children}
    </button>
  );
}
