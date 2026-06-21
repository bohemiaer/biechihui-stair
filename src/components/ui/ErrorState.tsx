import { AlertCircle } from 'lucide-react';

import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry, retryLabel = '重试', title = '出错了' }: ErrorStateProps) {
  return (
    <div className="rounded-xl border border-[#FFE3E3] bg-[#FFF5F5] p-5 text-[#C92A2A]">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 shrink-0" size={18} />
        <div>
          <h3 className="text-[14px] font-semibold">{title}</h3>
          <p className="mt-1 text-[13px] leading-6">{message}</p>
          {onRetry && <Button className="mt-4" onClick={onRetry} variant="danger">{retryLabel}</Button>}
        </div>
      </div>
    </div>
  );
}
