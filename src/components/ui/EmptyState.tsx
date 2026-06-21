import type { ReactNode } from 'react';

import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  icon?: ReactNode;
  onAction?: () => void;
}

export function EmptyState({ actionLabel, description, icon, onAction, title }: EmptyStateProps) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-[#EAEAEA] bg-[#F8F9FA] px-6 py-10 text-center">
      {icon && <div className="mb-4 text-[#ADB5BD]">{icon}</div>}
      <h3 className="text-[15px] font-semibold text-[#1A1A1A]">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-[13px] leading-6 text-[#868E96]">{description}</p>}
      {actionLabel && onAction && <Button className="mt-5" onClick={onAction} variant="primary">{actionLabel}</Button>}
    </div>
  );
}
