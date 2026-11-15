import { cn } from "@/lib/utils";

export function EmptyState({ icon, title, body, action, className }: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 rounded-2xl bg-muted p-3 text-cardinal">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
