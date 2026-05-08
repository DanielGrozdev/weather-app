import { useTranslation } from "react-i18next";

const LANGS = ["en", "bg", "fr"] as const;

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;

  return (
    <div className="flex items-center h-10 rounded-full border border-border bg-card backdrop-blur-md shadow-lg overflow-hidden">
      {LANGS.map((lang, idx) => (
        <button
          key={lang}
          type="button"
          aria-label={`Switch language to ${lang.toUpperCase()}`}
          aria-pressed={current === lang}
          onClick={() => i18n.changeLanguage(lang)}
          className={[
            "h-full px-3 text-sm font-semibold tracking-tight transition-colors",
            idx !== 0 ? "border-l border-border" : "",
            current === lang
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-card/70",
          ].join(" ")}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
