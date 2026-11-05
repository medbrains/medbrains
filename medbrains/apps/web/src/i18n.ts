import i18n from "i18next";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

// Loaded at start, because every screen uses them. Each other namespace loads when the first
// component naming it in `useTranslation` appears, so a screen fetches only its own words.
const NS = ["common", "nav"] as const;

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
      // Ask the server each time, so newly-added keys never show as raw strings, but let an
      // unchanged file answer 304 instead of downloading it again.
      requestOptions: { cache: "no-cache" },
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
