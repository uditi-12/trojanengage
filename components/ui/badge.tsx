import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3", {
  variants: {
    variant: {
      default: "bg-cardinal text-white",
      gold: "bg-gold text-neutral-900",
      secondary: "bg-muted text-foreground",
      outline: "border text-foreground",
      success: "bg-emerald-100 text-emerald-800",
      warning: "bg-amber-100 text-amber-900",
      danger: "bg-red-100 text-red-800",
      glass: "bg-white/20 text-white backdrop-blur",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
