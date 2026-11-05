type Props = { label: string; hint?: string; children: React.ReactNode; className?: string };

export function Field({ label, hint, children, className = "" }: Props) {
  return (
    <label className={`block ${className}`}>
      <span className="font-label text-[11px] text-muted uppercase">{label}</span>
      <div className="mt-2">{children}</div>
      {hint && <span className="mt-1.5 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 select-none">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="pixel-clip relative h-6 w-11 bg-surface-3 transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 [--step:2px] after:absolute after:top-1 after:left-1 after:size-4 after:bg-text after:transition-transform peer-checked:after:translate-x-5 peer-checked:after:bg-accent-ink" />
      <span className="text-sm">{label}</span>
    </label>
  );
}

export function Panel({ title, children, actions, className = "" }: { title?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section className={`pixel-clip pixel-frame p-6 [--step:5px] ${className}`}>
      {(title || actions) && (
        <div className="mb-5 flex items-center justify-between gap-4">
          {title && <h2 className="font-pixel text-xl">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-pixel text-4xl leading-none">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

const statusStyles: Record<string, string> = {
  paid: "bg-accent/15 text-accent",
  pending: "bg-warning/15 text-warning",
  refunded: "bg-accent-2/20 text-accent-3",
  cancelled: "bg-surface-3 text-faint",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${statusStyles[status] ?? "bg-surface-3 text-muted"}`}>{status}</span>;
}
