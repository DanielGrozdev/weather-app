import { Settings } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useUnits } from "../../hooks/useUnits";

const LANGS = ["en", "bg", "fr"] as const;

export default function SettingsButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { i18n, t } = useTranslation();
  const { units, toggle: toggleUnits } = useUnits();

  useClickOutside(ref, useCallback(() => setOpen(false), []), open);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("controls.settings")}
        aria-expanded={open}
        className={[
          "size-10 rounded-full grid place-items-center",
          "border border-border bg-card backdrop-blur-md shadow-lg",
          "text-muted-foreground hover:text-foreground hover:bg-card/70 transition-colors",
          open ? "text-foreground bg-card/70" : "",
        ].join(" ")}
      >
        <Settings className="size-4.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-52 rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl p-3 space-y-4">
          {/* Units */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-0.5">
              {t("controls.units")}
            </p>
            <button
              type="button"
              onClick={toggleUnits}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-muted/35 hover:bg-muted/50 transition-colors text-left"
            >
              <span className="text-sm text-foreground/90">
                {units === "metric" ? "Celsius" : "Fahrenheit"}
              </span>
              <span className="text-xs font-semibold text-primary">
                {units === "metric" ? "°C" : "°F"}
              </span>
            </button>
          </div>

          <div className="h-px bg-border/70" />

          {/* Language */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-0.5">
              {t("controls.language")}
            </p>
            <div className="flex gap-1.5">
              {LANGS.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  aria-pressed={i18n.language === lang}
                  onClick={() => {
                    i18n.changeLanguage(lang);
                    setOpen(false);
                  }}
                  className={[
                    "flex-1 py-1.5 rounded-xl text-sm font-semibold tracking-tight transition-colors",
                    i18n.language === lang
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/35 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  ].join(" ")}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
