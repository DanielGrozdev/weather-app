import { ChevronLeft, ChevronRight, GripHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  valueMinutes: number;
  onChangeMinutes: (minutes: number) => void;
  containerRef: React.RefObject<HTMLElement | null>;
  className?: string;
};

const STEP_MINUTES = 30;
const MIN_MINUTES = -48 * 60;
const MAX_MINUTES = 48 * 60;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatTimeLabel(minutesOffset: number) {
  const d = new Date(Date.now() + minutesOffset * 60_000);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export default function TimeScrubber({
  valueMinutes,
  onChangeMinutes,
  containerRef,
  className,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
  } | null>(null);

  // Panel position within the container (px).
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    // Initialize to bottom-left-ish once we have a container and size.
    if (pos) return;
    const el = rootRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setPos({
      left: 12,
      top: Math.max(12, c.height - r.height - 12),
    });
  }, [containerRef, pos]);

  const label = useMemo(() => formatTimeLabel(valueMinutes), [valueMinutes]);

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest("[data-drag-handle]")) return;
    const container = containerRef.current;
    const root = rootRef.current;
    if (!container || !root) return;

    const c = container.getBoundingClientRect();
    const r = root.getBoundingClientRect();

    const currentLeft = pos?.left ?? r.left - c.left;
    const currentTop = pos?.top ?? r.top - c.top;

    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originLeft: currentLeft,
      originTop: currentTop,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragState.current;
    const container = containerRef.current;
    const root = rootRef.current;
    if (!drag || !container || !root) return;

    const c = container.getBoundingClientRect();
    const r = root.getBoundingClientRect();
    const maxLeft = Math.max(0, c.width - r.width);
    const maxTop = Math.max(0, c.height - r.height);

    const nextLeft = clamp(
      drag.originLeft + (e.clientX - drag.startX),
      0,
      maxLeft,
    );
    const nextTop = clamp(
      drag.originTop + (e.clientY - drag.startY),
      0,
      maxTop,
    );
    setPos({ left: nextLeft, top: nextTop });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    dragState.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // no-op
    }
  };

  return (
    <div
      ref={rootRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={[
        "pointer-events-auto select-none",
        "rounded-2xl border border-border bg-card/70 backdrop-blur-md shadow-2xl",
        "w-[min(560px,calc(100vw-24px))]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        pos
          ? {
              position: "absolute",
              left: pos.left,
              top: pos.top,
              zIndex: 1100,
            }
          : { position: "absolute", left: 12, bottom: 12, zIndex: 1100 }
      }
    >
      <div
        data-drag-handle
        className="cursor-grab active:cursor-grabbing px-3 pt-2 pb-1 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <GripHorizontal className="size-4" />
          <span className="text-xs uppercase tracking-wider">Time</span>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {label}
        </div>
      </div>

      <div className="px-3 pb-3 flex items-center gap-3">
        <button
          type="button"
          aria-label="Step back"
          onClick={() =>
            onChangeMinutes(
              clamp(valueMinutes - STEP_MINUTES, MIN_MINUTES, MAX_MINUTES),
            )
          }
          className="size-8 rounded-full grid place-items-center bg-muted/40 hover:bg-muted/60 text-foreground/80 transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>

        <input
          type="range"
          min={MIN_MINUTES}
          max={MAX_MINUTES}
          step={STEP_MINUTES}
          value={valueMinutes}
          onChange={(e) => onChangeMinutes(Number(e.target.value))}
          className="flex-1 accent-primary"
        />

        <button
          type="button"
          aria-label="Step forward"
          onClick={() =>
            onChangeMinutes(
              clamp(valueMinutes + STEP_MINUTES, MIN_MINUTES, MAX_MINUTES),
            )
          }
          className="size-8 rounded-full grid place-items-center bg-muted/40 hover:bg-muted/60 text-foreground/80 transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
