import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: "en",
    fallbackLng: "en",
    supportedLngs: ["en"],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

if (typeof window !== "undefined") {
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
}

export default i18n;
