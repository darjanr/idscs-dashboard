import { mk } from "./mk";
import { al } from "./al";

export type Lang = "mk" | "al";
export const languages: Record<Lang, string> = { mk: "МК", al: "АЛ" };
export const defaultLang: Lang = "mk";

const translations = { mk, al };

export function t(lang: Lang, key: string): string {
  const keys = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let val: any = translations[lang];
  for (const k of keys) {
    val = val?.[k];
  }
  if (val === undefined) {
    // Fall back to MK if key missing in AL
    let fallback: any = translations["mk"];
    for (const k of keys) fallback = fallback?.[k];
    return fallback ?? key;
  }
  return val;
}

export function getLangFromURL(url: URL): Lang {
  const [, lang] = url.pathname.split("/");
  if (lang in translations) return lang as Lang;
  return defaultLang;
}
