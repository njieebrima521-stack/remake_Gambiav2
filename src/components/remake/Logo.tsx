import { Recycle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-display text-xl font-semibold tracking-tight",
        className,
      )}
    >
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow">
        <Recycle className="size-5" strokeWidth={2.4} />
      </span>
      {!compact && (
        <span>
          Re<span className="text-primary">make</span>
        </span>
      )}
    </span>
  );
}
