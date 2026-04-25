import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";

const NS = [
  "common",
  "nav",
  "clinical",
  "dashboard",
  "patients",
  "opd",
  "lab",
  "pharmacy",
  "billing",
  "ipd",
  "admin",
  "emergency",
  "lms",
] as const;

/** Languages with RTL text direction */
export const RTL_LANGUAGES = new Set(["ar", "ur", "he", "fa"]);

/** Supported languages with display names */
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", dir: "ltr" },
  { code: "ta", name: "தமிழ்", dir: "ltr" },
  { code: "hi", name: "हिन्दी", dir: "ltr" },
  { code: "ar", name: "العربية", dir: "rtl" },
] as const;

i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: "en",
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    ns: [...NS],
    defaultNS: "common",
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
