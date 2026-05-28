import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import it from "./locales/it.json";
import es from "./locales/es.json";
import de from "./locales/de.json";
import pt from "./locales/pt.json";
import zh from "./locales/zh.json";
import fr from "./locales/fr.json";
import ar from "./locales/ar.json";

export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
] as const;

export const RTL_LANGS = new Set(["ar"]);
const SUPPORTED = LANGUAGES.map((l) => l.code) as string[];
const STORAGE_KEY = "lang";

if (!i18n.isInitialized) {
  // Synchronous init with a deterministic initial language ("en") so
  // server and client render the same markup on first paint.
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      it: { translation: it },
      es: { translation: es },
      de: { translation: de },
      pt: { translation: pt },
      zh: { translation: zh },
      fr: { translation: fr },
      ar: { translation: ar },
    },
    lng: "en",
    fallbackLng: "en",
    supportedLngs: SUPPORTED,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    
  });
}

// Apply the user's saved/preferred language AFTER hydration to avoid
// SSR/CSR mismatch. Runs only in the browser.
if (typeof window !== "undefined") {
  const pickLang = (): string => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.includes(saved)) return saved;
    } catch {
      /* ignore */
    }
    const nav = (window.navigator.language || "en").slice(0, 2).toLowerCase();
    return SUPPORTED.includes(nav) ? nav : "en";
  };

  const apply = (lng: string) => {
    document.documentElement.lang = lng;
    document.documentElement.dir = RTL_LANGS.has(lng) ? "rtl" : "ltr";
  };

  // Defer until after first paint so initial hydration matches the SSR HTML.
  const desired = pickLang();
  if (desired !== i18n.language) {
    queueMicrotask(() => {
      i18n.changeLanguage(desired);
    });
  } else {
    apply(desired);
  }

  i18n.on("languageChanged", (lng) => {
    apply(lng);
    try {
      window.localStorage.setItem(STORAGE_KEY, lng);
    } catch {
      /* ignore */
    }
  });
}

export default i18n;
