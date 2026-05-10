import { ChevronDown, ChevronUp } from "lucide-react";
import { type ReactNode, useState } from "react";

type Props = {
  children: ReactNode;
  label?: string;
};

// Height of the always-visible handle strip (px).
const HANDLE_H = 44;

export default function BottomDrawer({ children, label = "Forecast" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[1100] pointer-events-auto
                 rounded-t-2xl border-t border-x border-border bg-card/75 backdrop-blur-md shadow-2xl
                 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
      style={{
        transform: open ? "translateY(0)" : `translateY(calc(100% - ${HANDLE_H}px))`,
        willChange: "transform",
      }}
    >
      {/* Handle — always visible, acts as toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? `Close ${label}` : `Open ${label}`}
        className="w-full flex items-center justify-center gap-2 select-none
                   text-xs uppercase tracking-wider text-muted-foreground
                   hover:text-foreground transition-colors"
        style={{ height: HANDLE_H }}
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        <span>{label}</span>
      </button>

      {/* Scrollable content */}
      <div
        className="overflow-y-auto"
        style={{ maxHeight: `calc(50vh - ${HANDLE_H}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
