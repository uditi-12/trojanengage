"use client";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  side?: "bottom" | "right";
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** Bottom sheet (mobile) or right drawer, animated with framer-motion. */
export function Sheet({ open, onClose, side = "bottom", title, children, className }: SheetProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  const variants =
    side === "bottom"
      ? { hidden: { y: "100%" }, shown: { y: 0 } }
      : { hidden: { x: "100%" }, shown: { x: 0 } };
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div className="absolute inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            className={cn(
              "absolute bg-card shadow-2xl",
              side === "bottom" ? "inset-x-0 bottom-0 mx-auto max-w-md rounded-t-3xl p-5 pb-8" : "inset-y-0 right-0 w-full max-w-lg overflow-y-auto p-5",
              className,
            )}
            variants={variants}
            initial="hidden"
            animate="shown"
            exit="hidden"
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            {side === "bottom" && <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />}
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold">{title}</div>
              <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
