import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Slider } from "radix-ui";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ─── constants ────────────────────────────────────────────────────────────────

const STEP_HOURS = 3;
const STEP_COUNT = 17; // step 0 = live, steps 1-16 = 3 h increments up to +48 h
const DEBOUNCE_MS = 400;
const PLAY_INTERVAL_MS = 2000;

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildTimeSteps(): number[] {
  const nowSec = Math.floor(Date.now() / 1000);
  const stepSec = STEP_HOURS * 3600;
  const base = Math.ceil(nowSec / stepSec) * stepSec;
  return [
    0,
    ...Array.from({ length: STEP_COUNT - 1 }, (_, i) => base + i * stepSec),
  ];
}

function formatStep(ts: number, lang: string): string {
  return new Date(ts * 1000).toLocaleString(lang, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
}

// ─── component ────────────────────────────────────────────────────────────────

type Props = {
  selectedTime: number;
  onChange: (time: number) => void;
};

export default function TimeScrubber({ selectedTime, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const [timeSteps, setTimeSteps] = useState(buildTimeSteps);

  useEffect(() => {
    const id = setInterval(() => {
      setTimeSteps(buildTimeSteps());
    }, 60_000); // every minute

    return () => clearInterval(id);
  }, []);

  console.log(timeSteps);

  const [localIndex, setLocalIndex] = useState(() => {
    const idx = timeSteps.indexOf(selectedTime);
    return idx >= 0 ? idx : 0;
  });
  const [playing, setPlaying] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const localIndexRef = useRef(localIndex);
  useLayoutEffect(() => {
    localIndexRef.current = localIndex;
  });
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const stopPlayback = useCallback(() => {
    setPlaying(false);
  }, []);

  const handleChange = useCallback(
    (index: number) => {
      if (playing) stopPlayback();
      setLocalIndex(index);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChangeRef.current(timeSteps[index]);
      }, DEBOUNCE_MS);
    },
    [playing, stopPlayback, timeSteps],
  );

  const stepBy = useCallback(
    (delta: number) => {
      if (playing) stopPlayback();
      const next = Math.max(
        0,
        Math.min(STEP_COUNT - 1, localIndexRef.current + delta),
      );
      if (next === localIndexRef.current) return;
      setLocalIndex(next);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChangeRef.current(timeSteps[next]);
      }, DEBOUNCE_MS);
    },
    [playing, stopPlayback, timeSteps],
  );

  // Advance one step every PLAY_INTERVAL_MS; stop and reset when end is reached
  useEffect(() => {
    if (!playing) return;

    const id = setInterval(() => {
      const prev = localIndexRef.current;
      if (prev >= STEP_COUNT - 1) {
        setPlaying(false);
        setLocalIndex(0);
        onChangeRef.current(timeSteps[0]);
        return;
      }
      const next = prev + 1;
      setLocalIndex(next);
      onChangeRef.current(timeSteps[next]);
    }, PLAY_INTERVAL_MS);

    return () => clearInterval(id);
  }, [playing, timeSteps]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const isLive = localIndex === 0;

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-card/50 backdrop-blur-md shadow-2xl text-foreground px-4 pt-3 pb-3.5 select-none">
      {/* Time badge — centered pill */}
      <div className="flex justify-center mb-3">
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/25 text-sky-400 text-[11px] font-semibold tracking-wide">
            <span className="size-1.5 rounded-full bg-sky-400 animate-pulse" />
            {t("timeScrubber.live")}
          </span>
        ) : (
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/5 border border-white/10 text-foreground/70 text-[11px] font-medium">
            {formatStep(timeSteps[localIndex], i18n.language)}
          </span>
        )}
      </div>

      {/* Controls row */}
      <div className="flex items-start gap-2.5">
        {/* Step back */}
        <button
          onClick={() => stepBy(-1)}
          disabled={localIndex === 0}
          aria-label={t("timeScrubber.stepBack")}
          className="shrink-0 size-7 flex items-center justify-center rounded-full
                     bg-white/5 border border-white/10 text-foreground/50
                     hover:bg-white/10 hover:text-foreground hover:border-white/20
                     disabled:opacity-20 disabled:cursor-not-allowed
                     transition-all duration-150"
        >
          <ChevronLeft className="size-3.5" />
        </button>

        {/* Slider */}
        <div className="flex-1 min-w-0">
          <Slider.Root
            className="relative flex items-center select-none touch-none w-full h-5 cursor-pointer"
            aria-label={t("timeScrubber.label")}
            value={[localIndex]}
            onValueChange={([v]) => handleChange(v)}
            min={0}
            max={STEP_COUNT - 1}
            step={1}
          >
            <Slider.Track className="relative grow rounded-full h-[3px] bg-white/8">
              <Slider.Range className="absolute h-full rounded-full bg-linear-to-r from-sky-500/60 to-sky-400/90" />
            </Slider.Track>
            <Slider.Thumb
              className="block size-4 rounded-full bg-white shadow-lg
                         ring-2 ring-white/20
                         focus:outline-none focus:ring-sky-400/60
                         hover:scale-110 active:scale-95
                         transition-transform will-change-transform cursor-grab active:cursor-grabbing"
            />
          </Slider.Root>

          {/* Step ticks */}
          <div className="flex justify-between mt-1.5 px-[7px]">
            {Array.from({ length: STEP_COUNT }, (_, i) => (
              <span
                key={i}
                className={[
                  "rounded-full transition-colors duration-150",
                  i === 0 || i === STEP_COUNT - 1 ? "size-1" : "size-0.5",
                  i === localIndex
                    ? "bg-sky-400"
                    : i < localIndex
                      ? "bg-white/30"
                      : "bg-white/12",
                ].join(" ")}
              />
            ))}
          </div>

          {/* Edge labels */}
          <div className="flex justify-between mt-1 px-0.5">
            <span className="text-[9px] text-white/25 uppercase tracking-widest">
              {t("timeScrubber.live")}
            </span>
            <span className="text-[9px] text-white/25">+48h</span>
          </div>
        </div>

        {/* Step forward */}
        <button
          onClick={() => stepBy(1)}
          disabled={localIndex === STEP_COUNT - 1}
          aria-label={t("timeScrubber.stepForward")}
          className="shrink-0 size-7 flex items-center justify-center rounded-full
                     bg-white/5 border border-white/10 text-foreground/50
                     hover:bg-white/10 hover:text-foreground hover:border-white/20
                     disabled:opacity-20 disabled:cursor-not-allowed
                     transition-all duration-150"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
