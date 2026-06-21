import type { InputHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  wrapperClassName?: string;
}

export function TextField({ className, error, id, label, wrapperClassName, ...props }: TextFieldProps) {
  return (
    <div className={cn('space-y-2', wrapperClassName)}>
      <label className="text-[13px] font-medium text-[#495057]" htmlFor={id}>
        {label}
      </label>
      <input
        aria-invalid={Boolean(error)}
        className={cn(
          'w-full rounded-xl border border-[#EAEAEA] bg-[#F8F9FA] px-4 py-3 text-[14px] text-[#212529] transition-colors focus:border-[#ADB5BD] focus:bg-white focus:outline-none',
          error && 'border-[#FFC9C9] bg-[#FFF5F5]',
          className,
        )}
        id={id}
        {...props}
      />
      {error && <p className="text-[12px] text-[#C92A2A]">{error}</p>}
    </div>
  );
}
