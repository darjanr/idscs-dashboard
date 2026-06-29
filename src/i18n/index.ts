import mk from "./mk.json";
import al from "./al.json";
import en from "./en.json";

export type Translations = typeof mk;
export type Lang = "mk" | "al" | "en";
export const languages: Record<Lang, string> = { mk: "МК", al: "АЛ", en: "EN" };
export const defaultLang: Lang = "mk";
export const LANGS: Lang[] = ["mk", "al", "en"];

const translations = { mk, al, en };

export function t(lang: Lang, key: string): string {
  const keys = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let val: any = translations[lang];
  for (const k of keys) {
    val = val?.[k];
  }
  if (val === undefined) {
    // Fall back to MK if a key is missing in the requested language
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fallback: any = translations["mk"];
    for (const k of keys) fallback = fallback?.[k];
    return fallback ?? key;
  }
  return val;
}

// Direct access to a language's full dictionary — for arrays / structured
// content (page prose, methodology sources) that `t()` can't return.
export function dict(lang: Lang) {
  return translations[lang];
}

export function getLangFromURL(url: URL): Lang {
  const [, lang] = url.pathname.split("/");
  if (lang in translations) return lang as Lang;
  return defaultLang;
}
