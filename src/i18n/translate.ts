// Per-language display of data values (MP names + party names) that live in the
// datasets in Macedonian Cyrillic. MK returns the original; AL/EN look up a
// curated/API-sourced map and fall back to the original if unknown.
import parties from "./parties.json";
import mpNames from "./mp_names.json";
import institutions from "./institutions.json";
import caseTypes from "./case_types.json";
import ethnicities from "./ethnicities.json";
import type { Lang } from "./index";

type PartyEntry = { al: string; en: string; acrMk: string; acrAl: string; acrEn: string };
type NameEntry = { al: string; en: string };

const partyMap = parties as Record<string, PartyEntry>;
const nameMap = mpNames as Record<string, NameEntry>;
const instMap = institutions as Record<string, NameEntry>;
const caseTypeMap = caseTypes as Record<string, NameEntry>;
const ethnicityMap = ethnicities as Record<string, NameEntry>;

export function tName(lang: Lang, name: string | undefined | null): string {
  if (!name) return name ?? "";
  if (lang === "mk") return name;
  return nameMap[name]?.[lang] ?? name;
}

export function tParty(lang: Lang, party: string | undefined | null): string {
  if (!party) return party ?? "";
  if (lang === "mk") return party;
  return partyMap[party]?.[lang] ?? party;
}

export function tInst(lang: Lang, inst: string | undefined | null): string {
  if (!inst) return inst ?? "";
  if (lang === "mk") return inst;
  return instMap[inst]?.[lang] ?? inst;
}

export function tCaseType(lang: Lang, caseType: string | undefined | null): string {
  if (!caseType) return caseType ?? "";
  if (lang === "mk") return caseType;
  return caseTypeMap[caseType]?.[lang] ?? caseType;
}

export function tEthnicity(lang: Lang, ethnicity: string | undefined | null): string {
  if (!ethnicity) return ethnicity ?? "";
  if (lang === "mk") return ethnicity;
  return ethnicityMap[ethnicity]?.[lang] ?? ethnicity;
}

export function partyAcr(lang: Lang, party: string | undefined | null): string {
  if (!party) return "—";
  const e = partyMap[party];
  if (e) return lang === "al" ? e.acrAl : lang === "en" ? e.acrEn : e.acrMk;
  return party.split(" ").filter(w => w.length > 2).map(w => w[0]).join("").toUpperCase().slice(0, 5);
}
