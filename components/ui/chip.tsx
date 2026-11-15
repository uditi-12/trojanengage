"use client";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Chip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all active:scale-95",
        active ? "border-cardinal bg-cardinal text-white shadow-sm" : "border-border bg-card hover:border-cardinal/40",
        className,
      )}
    >
      {active && <Check className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}
