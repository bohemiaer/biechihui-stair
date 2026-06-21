import { Button } from './Button';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ cancelLabel = '取消', confirmLabel = '确认', description, onCancel, onConfirm, title }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1A]/30 p-4">
      <div className="w-full max-w-[420px] rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
        <h2 className="text-[16px] font-semibold text-[#1A1A1A]">{title}</h2>
        <p className="mt-3 text-[14px] leading-6 text-[#868E96]">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button onClick={onConfirm} variant="danger">{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
