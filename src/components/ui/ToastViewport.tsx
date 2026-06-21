import { useEffect } from 'react';

import { useUiStore } from '../../stores/uiStore';

export function ToastViewport() {
  const toastMessage = useUiStore((state) => state.toastMessage);
  const clearToast = useUiStore((state) => state.clearToast);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = window.setTimeout(clearToast, 2400);

    return () => window.clearTimeout(timer);
  }, [clearToast, toastMessage]);

  if (!toastMessage) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[80] -translate-x-1/2">
      <div className="rounded-xl border border-[#EAEAEA] bg-[#1A1A1A] px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
        {toastMessage}
      </div>
    </div>
  );
}
