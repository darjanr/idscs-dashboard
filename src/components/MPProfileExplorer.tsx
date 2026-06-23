"use client";
import { useState, useMemo } from "react";
import type { Lang } from "../i18n";
import { t } from "../i18n";

interface Profile {
  name: string;
  party: string;
  photo?: string | null;
  questions: {
    total: number;
    answered: number;
    topInstitutions: { institution: string; count: number }[];
    recentQuestions: { id: string; date: string | null; question: string; toInstitution: string | null; status: string }[];
  };
  activity: {
    attendance: number;
    excused: number;
    unexcused: number;
    discussions: number;
    proposedLaws: number;
    amendments: number;
    committeesAsMember: number;
    attendanceMember: number;
    period: string;
  } | null;
  office: {
    totalCases: number;
    totalMeetings: number;
    totalEvents: number;
    totalInitiatives: number;
    casesByType: Record<string, number | undefined>;
  } | null;
}

interface Props {
  profiles: Profile[];
  lang: Lang;
}

const TEAL = "#0d9488";
const NAVY = "#1a2e5a";
const TOTAL_SESSIONS = 56;

type SortKey = "name" | "composite" | "questions" | "attendance" | "discussions" | "laws" | "amendments" | "committees";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name",        label: "Абецеден ред" },
  { key: "composite",   label: "Општа активност" },
  { key: "questions",   label: "Прашања (2024–28)" },
  { key: "attendance",  label: "Присуство" },
  { key: "discussions", label: "Дискусии" },
  { key: "laws",        label: "Закони" },
  { key: "amendments",  label: "Амандмани" },
  { key: "committees",  label: "Комисии" },
];

export default function MPProfileExplorer({ profiles, lang }: Props) {
  const [search, setSearch] = useState("");
  const [filterParty, setFilterParty] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [selected, setSelected] = useState<Profile | null>(null);

  const parties = useMemo(() =>
    ["all", ...Array.from(new Set(profiles.map(p => p.party).filter(Boolean))).sort()],
    [profiles]);

  // Composite: normalised sum across all 6 metrics (same weights as Tab 2)
  const compositeMap = useMemo(() => {
    const all = profiles.filter(p => p.questions.total > 0 || p.activity || p.office);
    const maxQ  = Math.max(...all.map(p => p.questions.total), 1);
    const maxA  = TOTAL_SESSIONS;
    const maxD  = Math.max(...all.map(p => p.activity?.discussions ?? 0), 1);
    const maxL  = Math.max(...all.map(p => p.activity?.proposedLaws ?? 0), 1);
    const maxAm = Math.max(...all.map(p => p.activity?.amendments ?? 0), 1);
    const maxC  = Math.max(...all.map(p => p.activity?.committeesAsMember ?? 0), 1);
    return new Map(all.map(p => [p.name,
      p.questions.total / maxQ +
      (p.activity?.attendance ?? 0) / maxA * 0.5 +
      (p.activity?.discussions ?? 0) / maxD +
      (p.activity?.proposedLaws ?? 0) / maxL * 1.5 +
      (p.activity?.amendments ?? 0) / maxAm +
      (p.activity?.committeesAsMember ?? 0) / maxC * 0.5
    ]));
  }, [profiles]);

  function getVal(p: Profile, key: SortKey): number {
    if (key === "composite")   return compositeMap.get(p.name) ?? 0;
    if (key === "questions")   return p.questions.total;
    if (key === "attendance")  return p.activity?.attendance ?? 0;
    if (key === "discussions") return p.activity?.discussions ?? 0;
    if (key === "laws")        return p.activity?.proposedLaws ?? 0;
    if (key === "amendments")  return p.activity?.amendments ?? 0;
    if (key === "committees")  return p.activity?.committeesAsMember ?? 0;
    return 0;
  }

  const filtered = useMemo(() => {
    // Show the full active assembly (120) — including MPs seated after the report
    // period who have no activity/office data yet.
    let list = [...profiles];
    if (filterParty !== "all") list = list.filter(p => p.party === filterParty);
    if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    if (sortBy === "name") return list.sort((a, b) => a.name.localeCompare(b.name));
    return list.sort((a, b) => getVal(b, sortBy) - getVal(a, sortBy));
  }, [profiles, filterParty, search, sortBy, compositeMap]);

  const CHIP_DEFS = [
    { key: "questions",   label: t(lang, "mymp.colQuestions") + " (2024–28)", color: NAVY },
    { key: "attendance",  label: t(lang, "mymp.colAttendance"),               color: TEAL },
    { key: "discussions", label: t(lang, "mymp.colDiscussions"),              color: TEAL },
    { key: "laws",        label: t(lang, "mymp.colLaws"),                     color: NAVY },
    { key: "amendments",  label: t(lang, "mymp.colAmendments"),               color: TEAL },
    { key: "committees",  label: t(lang, "mymp.colCommittees"),               color: NAVY },
  ] as const;

  // Max values across all profiles for proportional bars
  const maxVals = useMemo(() => ({
    questions:   Math.max(...profiles.map(p => p.questions.total), 1),
    attendance:  TOTAL_SESSIONS,
    discussions: Math.max(...profiles.map(p => p.activity?.discussions ?? 0), 1),
    laws:        Math.max(...profiles.map(p => p.activity?.proposedLaws ?? 0), 1),
    amendments:  Math.max(...profiles.map(p => p.activity?.amendments ?? 0), 1),
    committees:  Math.max(...profiles.map(p => p.activity?.committeesAsMember ?? 0), 1),
  }), [profiles]);

  function chipValue(profile: Profile, key: typeof CHIP_DEFS[number]["key"]): string {
    if (key === "questions") return String(profile.questions.total);
    if (!profile.activity) return "—";
    if (key === "attendance") return `${profile.activity.attendance}/${TOTAL_SESSIONS}`;
    if (key === "discussions") return String(profile.activity.discussions);
    if (key === "laws") return String(profile.activity.proposedLaws);
    if (key === "amendments") return String(profile.activity.amendments);
    if (key === "committees") return String(profile.activity.committeesAsMember);
    return "—";
  }

  function chipPct(profile: Profile, key: typeof CHIP_DEFS[number]["key"]): number {
    if (key === "questions") return profile.questions.total / maxVals.questions;
    if (!profile.activity) return 0;
    if (key === "attendance") return profile.activity.attendance / maxVals.attendance;
    if (key === "discussions") return profile.activity.discussions / maxVals.discussions;
    if (key === "laws") return profile.activity.proposedLaws / maxVals.laws;
    if (key === "amendments") return profile.activity.amendments / maxVals.amendments;
    if (key === "committees") return profile.activity.committeesAsMember / maxVals.committees;
    return 0;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <input
          type="search"
          placeholder={t(lang, "common.search")}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <select
          value={filterParty}
          onChange={e => setFilterParty(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">{t(lang, "common.allParties")}</option>
          {parties.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 whitespace-nowrap">Сортирај по:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <span className="text-sm text-gray-400 ml-auto">{filtered.length} пратеници</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(profile => (
          <button
            key={profile.name}
            onClick={() => setSelected(profile)}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm text-left hover:border-teal-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 relative group"
          >
            {/* expand indicator */}
            <span
              className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gray-100 group-hover:bg-teal-100 flex items-center justify-center text-gray-400 group-hover:text-teal-600 transition-colors text-xs"
              aria-hidden="true"
            >↗</span>

            <div className="flex items-center gap-3 mb-4 pr-7">
              {profile.photo
                ? <img src={profile.photo} alt={profile.name} className="w-11 h-11 rounded-full object-cover object-top shrink-0 bg-gray-100" loading="lazy" />
                : <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center shrink-0 text-gray-400 font-bold text-lg">{profile.name[0]}</div>
              }
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 leading-tight truncate">{profile.name}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{profile.party || "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {CHIP_DEFS.map(({ key, label, color }) => {
                const pct = chipPct(profile, key);
                return (
                  <div key={key} className="bg-gray-50 rounded-lg px-2 pt-1.5 pb-1 overflow-hidden">
                    <p className="text-gray-400 leading-tight truncate" style={{ fontSize: "9px" }}>{label}</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5 mb-1.5">{chipValue(profile, key)}</p>
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div className="h-1 rounded-full transition-all" style={{ width: `${Math.round(pct * 100)}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </button>
        ))}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          role="dialog" aria-modal="true"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4 justify-between rounded-t-2xl">
              <div className="flex items-center gap-4">
                {selected.photo
                  ? <img src={selected.photo} alt={selected.name} className="w-16 h-16 rounded-full object-cover object-top bg-gray-100 shrink-0" />
                  : <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center shrink-0 text-gray-400 font-bold text-2xl">{selected.name[0]}</div>
                }
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selected.name}</h2>
                  <p className="text-sm text-gray-500">{selected.party || "—"}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none shrink-0">×</button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Questions section */}
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {t(lang, "profile.sectionQuestions")}
                </h3>
                {selected.questions.total > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">{t(lang, "common.total")}</p>
                        <p className="text-2xl font-bold text-gray-900">{selected.questions.total}</p>
                      </div>
                      <div className="bg-teal-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">{t(lang, "common.answered")}</p>
                        <p className="text-2xl font-bold text-teal-700">
                          {selected.questions.answered}
                          <span className="text-sm text-gray-400 ml-1">
                            ({Math.round(selected.questions.answered / selected.questions.total * 100)}%)
                          </span>
                        </p>
                      </div>
                    </div>
                    {selected.questions.topInstitutions.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Најчесто адресирани институции</p>
                        <div className="space-y-1">
                          {selected.questions.topInstitutions.map(inst => (
                            <div key={inst.institution} className="flex items-center gap-2 text-sm">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                <div
                                  className="h-1.5 rounded-full"
                                  style={{
                                    width: `${(inst.count / selected.questions.topInstitutions[0].count) * 100}%`,
                                    backgroundColor: NAVY
                                  }}
                                />
                              </div>
                              <span className="text-gray-500 truncate max-w-[200px] text-xs">{inst.institution}</span>
                              <span className="font-semibold text-gray-700 w-5 text-right">{inst.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selected.questions.recentQuestions.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-2">Последни прашања</p>
                        <ul className="space-y-2">
                          {selected.questions.recentQuestions.map(q => (
                            <li key={q.id} className="text-sm text-gray-700 border-l-2 border-gray-200 pl-3">
                              <p className="truncate">{q.question}</p>
                              <p className="text-xs text-gray-400">{q.date || "—"} · {q.toInstitution || "Независно тело"}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400 italic">{t(lang, "profile.noQuestionsData")}</p>
                )}
              </section>

              {/* Activity section */}
              {selected.activity && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    {t(lang, "profile.sectionActivity")} <span className="normal-case font-normal text-gray-400">({selected.activity.period})</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: t(lang, "mymp.colAttendance"), value: `${selected.activity.attendance}/${TOTAL_SESSIONS}` },
                      { label: t(lang, "mymp.colDiscussions"), value: selected.activity.discussions },
                      { label: t(lang, "mymp.colLaws"), value: selected.activity.proposedLaws },
                      { label: t(lang, "mymp.colCommittees"), value: selected.activity.committeesAsMember },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-xl font-bold text-gray-900">{value}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Office section */}
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {t(lang, "profile.sectionOffice")}
                </h3>
                {selected.office ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      {[
                        { label: t(lang, "offices.kpiCases"), value: selected.office.totalCases },
                        { label: t(lang, "offices.kpiMeetings"), value: selected.office.totalMeetings },
                        { label: t(lang, "offices.kpiEvents"), value: selected.office.totalEvents },
                        { label: t(lang, "offices.kpiInitiatives"), value: selected.office.totalInitiatives },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">{label}</p>
                          <p className="text-xl font-bold text-gray-900">{value}</p>
                        </div>
                      ))}
                    </div>
                    {Object.keys(selected.office.casesByType).length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Случаи по тип</p>
                        <div className="space-y-1">
                          {Object.entries(selected.office.casesByType)
                            .filter((e): e is [string, number] => e[1] !== undefined)
                            .sort((a, b) => b[1] - a[1])
                            .map(([type, count]) => (
                              <div key={type} className="flex justify-between text-sm">
                                <span className="text-gray-600">{type}</span>
                                <span className="font-semibold text-gray-800">{count}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400 italic">{t(lang, "profile.noOfficeData")}</p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
