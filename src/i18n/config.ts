import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import bg from "./locales/bg.json";
import fr from "./locales/fr.json";

const LANG_KEY = "weather-app-lang";

function readStoredLang(): string {
  if (typeof window === "undefined") return "en";
  const raw = window.localStorage.getItem(LANG_KEY);
  return raw === "en" || raw === "bg" || raw === "fr" ? raw : "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    bg: { translation: bg },
    fr: { translation: fr },
  },
  lng: readStoredLang(),
  fallbackLng: "en",
  interpolation: {
    // React already escapes by default
    escapeValue: false,
  },
});

// Persist language changes
i18n.on("languageChanged", (lng) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANG_KEY, lng);
  }
});

export default i18n;
