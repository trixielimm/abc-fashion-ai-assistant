type SectionHeaderProps = {
  label: string;
  action?: React.ReactNode;
};

export function SectionHeader({ label, action }: SectionHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <p className="text-[10px] tracking-[0.24em] text-muted uppercase">
        {label}
      </p>
      {action}
    </div>
  );
}
