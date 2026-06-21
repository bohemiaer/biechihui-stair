import type { ReactNode } from 'react';

interface ThreeColumnLayoutProps {
  sidebar: ReactNode;
  list: ReactNode;
  detail: ReactNode;
}

export function ThreeColumnLayout({ detail, list, sidebar }: ThreeColumnLayoutProps) {
  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      <div className="h-full shrink-0">{sidebar}</div>
      <div className="h-full w-[352px] shrink-0 overflow-y-auto border-r border-[#EAEAEA]">{list}</div>
      <div className="h-full min-w-0 flex-1 overflow-y-auto">{detail}</div>
    </div>
  );
}
