interface ReadonlyContentProps {
  title?: string;
  children: string;
}

export function ReadonlyContent({ children, title }: ReadonlyContentProps) {
  return (
    <section className="space-y-3">
      {title && <h3 className="text-[16px] font-semibold text-[#1A1A1A]">{title}</h3>}
      <div className="whitespace-pre-wrap text-[15px] leading-8 text-[#495057]">{children}</div>
    </section>
  );
}
