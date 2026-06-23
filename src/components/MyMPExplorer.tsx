"use client";
import { useState, useMemo } from "react";
import type { Lang } from "../i18n";
import { t } from "../i18n";

interface MP {
  name: string;
  photo?: string | null;
  party?: string;
  hasData: boolean;
  attendance: number;
  excused: number;
  unexcused: number;
  discussions: number;
  replies: number;
  procedural: number;
  laws: number;
  amendments: number;
  proposedLaws: number;
  questions: number;
  committeesAsMember: number;
  sessionsHeldMember: number;
  attendanceMember: number;
  committeesAsDeputy: number;
  sessionsHeldDeputy: number;
  attendanceDeputy: number;
}

interface Props {
  mps: MP[];
  lang: Lang;
}

const TEAL = "#0d9488";
const NAVY = "#1a2e5a";
const TOTAL_SESSIONS = 56;

type SortKey = "composite" | "attendance" | "discussions" | "questions" | "laws" | "amendments" | "committeesAsMember";

export default function MyMPExplorer({ mps, lang }: Props) {
  const [search, setSearch] = useState("");
  const [chartSortBy, setChartSortBy] = useState<SortKey>("discussions");
  const [tableSortBy, setTableSortBy] = useState<SortKey>("attendance");
  const [tableSortDir, setTableSortDir] = useState<"asc" | "desc">("desc");
  const [showZeroOnly, setShowZeroOnly] = useState(false);
  const [selectedMP, setSelectedMP] = useState<MP | null>(null);

  // Activity report covers Jan–Jun 2025. MPs seated after that period (replacements
  // for those who joined the government) carry hasData=false — exclude them from
  // period stats and rankings so their absence isn't misread as inactivity.
  const withData = useMemo(() => mps.filter(m => m.hasData), [mps]);
  const newlySeated = mps.length - withData.length;

  // Composite activity score: each metric normalised 0–1, laws weighted higher
  const scoreMap = useMemo(() => {
    const max = (fn: (m: MP) => number) => Math.max(...withData.map(fn), 1);
    const mA = max(m => m.attendance), mD = max(m => m.discussions),
          mQ = max(m => m.questions), mL = max(m => m.laws),
          mAm = max(m => m.amendments), mC = max(m => m.committeesAsMember);
    return new Map<string, number>(withData.map(m => [m.name,
      m.attendance / mA * 0.5 +
      m.discussions / mD +
      m.questions / mQ +
      m.laws / mL * 1.5 +
      m.amendments / mAm +
      m.committeesAsMember / mC * 0.5
    ]));
  }, [withData]);

  // Score normalised to 0–100 for display
  function displayScore(m: MP): number {
    const maxScore = Math.max(...Array.from(scoreMap.values()), 1);
    return Math.round((scoreMap.get(m.name) ?? 0) / maxScore * 100);
  }

  function getVal(m: MP, key: SortKey): number {
    return m[key as keyof MP] as number;
  }

  function handleChartSort(key: SortKey) {
    setChartSortBy(key);
  }

  function handleTableSort(key: SortKey) {
    if (tableSortBy === key) {
      setTableSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setTableSortBy(key);
      setTableSortDir("desc");
    }
  }

  function sortedByChart(list: MP[]): MP[] {
    const k = chartSortBy as keyof MP;
    return [...list].sort((a, b) => (b[k] as number) - (a[k] as number));
  }

  function sortedByTable(list: MP[]): MP[] {
    const sorted = [...list].sort((a, b) =>
      tableSortBy === "composite"
        ? (scoreMap.get(b.name) ?? 0) - (scoreMap.get(a.name) ?? 0)
        : b[tableSortBy] - a[tableSortBy]
    );
    const dir = tableSortDir === "asc" ? sorted.reverse() : sorted;
    // MPs who joined after the report period (no data) always sink to the bottom.
    return [...dir].sort((a, b) => Number(b.hasData) - Number(a.hasData));
  }

  const top5 = useMemo(() =>
    [...withData].sort((a, b) => (scoreMap.get(b.name) ?? 0) - (scoreMap.get(a.name) ?? 0)).slice(0, 5),
    [withData, scoreMap]);

  const top15 = useMemo(() =>
    sortedByChart([...withData]).slice(0, 15),
    [withData, chartSortBy]);

  const filtered = useMemo(() => {
    let list = mps;
    if (search) list = list.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
    if (showZeroOnly) list = list.filter(m => m.hasData && m.questions === 0);
    return sortedByTable(list);
  }, [mps, search, tableSortBy, tableSortDir, showZeroOnly, scoreMap]);

  const zeroQuestions = withData.filter(m => m.questions === 0).length;
  const avgAttendance = Math.round(withData.reduce((s, m) => s + m.attendance, 0) / withData.length);

  const COL_LABEL: Record<SortKey, string> = {
    composite:          "Вкупна активност",
    attendance:         t(lang, "mymp.colAttendance"),
    discussions:        t(lang, "mymp.colDiscussions"),
    questions:          t(lang, "mymp.colQuestions"),
    laws:               t(lang, "mymp.colLaws"),
    amendments:         t(lang, "mymp.colAmendments"),
    committeesAsMember: t(lang, "mymp.colCommittees"),
  };

  // Attendance is near-identical across the top performers, so it goes last.
  const sortOptions: SortKey[] = ["discussions", "questions", "laws", "amendments", "committeesAsMember", "attendance"];

  function SortIcon({ col }: { col: SortKey }) {
    if (tableSortBy !== col) return <span className="ml-1 text-gray-300 font-normal">↕</span>;
    return <span className="ml-1 font-normal" style={{ color: TEAL }}>{tableSortDir === "desc" ? "↓" : "↑"}</span>;
  }

  const TABLE_COLS: SortKey[] = ["attendance", "discussions", "questions", "laws", "amendments", "committeesAsMember"];
  const CHIP_LABELS: { key: keyof MP; label: string }[] = [
    { key: "discussions", label: t(lang, "mymp.colDiscussions") },
    { key: "questions", label: t(lang, "mymp.colQuestions") },
    { key: "laws", label: t(lang, "mymp.colLaws") },
    { key: "amendments", label: t(lang, "mymp.colAmendments") },
    { key: "committeesAsMember", label: t(lang, "mymp.colCommittees") },
    { key: "attendance", label: t(lang, "mymp.colAttendance") },
  ];

  function downloadCSV() {
    const header = ["Пратеник", "Присуство", "Дискусии", "Прашања", "Закони", "Амандмани", "Комисии"];
    const rows = filtered.map(m => [m.name, m.attendance, m.discussions, m.questions, m.laws, m.amendments, m.committeesAsMember]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "mymp.csv"; a.click();
  }

  return (
    <div className="space-y-8">
      {/* Staleness notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        ⚠ {t(lang, "mymp.stalenessNote")}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm text-gray-500 font-medium">{t(lang, "mymp.kpiMPs")}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{mps.length}</p>
          {newlySeated > 0 && (
            <p className="text-xs text-gray-400 mt-1">{newlySeated} {t(lang, "mymp.newlySeatedNote")}</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm text-gray-500 font-medium">{t(lang, "mymp.kpiAvgAttendance")}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{avgAttendance}<span className="text-lg text-gray-400">/{TOTAL_SESSIONS}</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm col-span-2 lg:col-span-1">
          <p className="text-sm text-gray-500 font-medium">{t(lang, "mymp.kpiZeroQuestions")}</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">
            {zeroQuestions} <span className="text-lg text-gray-400">/ {mps.length}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">{Math.round(zeroQuestions / mps.length * 100)}% {t(lang, "mymp.zeroQuestionsLabel")}</p>
        </div>
      </div>

      {/* Top 5 most active — photo grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="font-semibold text-gray-800">Топ 5 најактивни пратеници</h2>
          <p className="text-xs text-gray-400 mt-0.5">{t(lang, "mymp.mostActiveNote")}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {top5.map((mp, i) => {
            const rankColors = ["#1a2e5a", "#0d9488", "#0d9488", "#64748b", "#64748b"];
            return (
              <button
                key={mp.name}
                onClick={() => setSelectedMP(mp)}
                className="flex flex-col items-center text-center p-4 rounded-xl border border-gray-100 hover:border-teal-300 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <span className="text-xs font-bold mb-2" style={{ color: rankColors[i] }}>#{i + 1}</span>
                {mp.photo
                  ? <img src={mp.photo} alt={mp.name} className="w-16 h-16 rounded-full object-cover object-top bg-gray-100 mb-3" loading="lazy" style={{ outline: i === 0 ? `3px solid ${NAVY}` : i <= 2 ? `2px solid ${TEAL}` : "none", outlineOffset: "2px" }} />
                  : <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-3 text-gray-400 font-bold text-xl">{mp.name[0]}</div>
                }
                <p className="text-sm font-semibold text-gray-900 leading-tight mb-1">{mp.name}</p>
                <p className="text-xs text-gray-400 mb-3 truncate w-full">{mp.party || ""}</p>
                <div className="w-full grid grid-cols-2 gap-1">
                  {CHIP_LABELS.map(({ key, label }) => (
                    <div key={key} className="bg-gray-50 rounded px-1.5 py-1 text-left">
                      <p className="text-gray-400 leading-none" style={{ fontSize: "9px" }}>{label}</p>
                      <p className="text-xs font-bold text-gray-800 mt-0.5">
                        {key === "attendance" ? `${mp[key]}/${TOTAL_SESSIONS}` : mp[key as keyof MP]}
                      </p>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top 15 ranked list */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <h2 className="font-semibold text-gray-800 mr-2">Топ 15 —</h2>
          <div className="flex gap-2 flex-wrap">
            {sortOptions.map(key => (
              <button
                key={key}
                onClick={() => handleChartSort(key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  chartSortBy === key ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={chartSortBy === key ? { backgroundColor: NAVY } : {}}
              >
                {COL_LABEL[key]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {top15.map((mp, i) => {
            const val = getVal(mp, chartSortBy);
            const maxVal = getVal(top15[0], chartSortBy);
            const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
            return (
              <div key={mp.name} className="flex items-center gap-3 cursor-pointer group" onClick={() => setSelectedMP(mp)}>
                <span className="text-xs font-bold text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                {mp.photo
                  ? <img src={mp.photo} alt={mp.name} className="w-9 h-9 rounded-full object-cover object-top bg-gray-100 shrink-0" loading="lazy" />
                  : <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0 text-gray-500 text-sm font-bold">{mp.name[0]}</div>
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium text-gray-900 truncate group-hover:text-teal-700">{mp.name}</span>
                    <span className="text-sm font-bold ml-2 shrink-0" style={{ color: i === 0 ? NAVY : TEAL }}>
                      {val}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: i === 0 ? NAVY : TEAL }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zero-questions highlight */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h2 className="font-semibold text-amber-900 mb-1">{t(lang, "mymp.zeroQuestionsLabel")}</h2>
        <p className="text-sm text-amber-700 mb-3">
          {zeroQuestions} од {mps.length} пратеници не поставиле ниту едно прашање во периодот јануари–јуни 2025.
        </p>
        <div className="flex flex-wrap gap-2">
          {withData.filter(m => m.questions === 0).map(m => (
            <button
              key={m.name}
              onClick={() => setSelectedMP(m)}
              className="px-3 py-1 bg-white border border-amber-300 rounded-full text-xs text-amber-800 hover:bg-amber-100 transition-colors"
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* Table with sortable headers */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <input
            type="search"
            placeholder={t(lang, "common.search")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showZeroOnly} onChange={e => setShowZeroOnly(e.target.checked)} className="rounded" />
            Само без прашања
          </label>
          <span className="text-sm text-gray-400 ml-auto">{filtered.length} пратеници</span>
          <button onClick={downloadCSV} className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
            {t(lang, "common.downloadCSV")}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">{t(lang, "mymp.colMP")}</th>
                {TABLE_COLS.map(col => (
                  <th
                    key={col}
                    className="px-4 py-3 text-right cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                    onClick={() => handleTableSort(col)}
                  >
                    {COL_LABEL[col]}<SortIcon col={col} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(m => (
                <tr
                  key={m.name}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedMP(m)}
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && setSelectedMP(m)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                  {m.hasData ? (
                    <>
                      <td className="px-4 py-3 text-right text-gray-700">
                        <span className="flex items-center justify-end gap-1">
                          {m.attendance}<span className="text-xs text-gray-400">/{TOTAL_SESSIONS}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{m.discussions}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={m.questions === 0 ? "text-amber-600 font-semibold" : "text-gray-700"}>{m.questions}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{m.laws}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{m.amendments}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{m.committeesAsMember}</td>
                    </>
                  ) : (
                    <td className="px-4 py-3 text-center text-xs text-gray-400 italic" colSpan={6}>
                      {t(lang, "mymp.noPeriodData")}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MP detail modal */}
      {selectedMP && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog" aria-modal="true"
          onClick={e => { if (e.target === e.currentTarget) setSelectedMP(null); }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center gap-4 justify-between mb-5">
              <div className="flex items-center gap-4">
                {selectedMP.photo
                  ? <img src={selectedMP.photo} alt={selectedMP.name} className="w-16 h-16 rounded-full object-cover object-top bg-gray-100 shrink-0" />
                  : <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center shrink-0 text-gray-400 font-bold text-2xl">{selectedMP.name[0]}</div>
                }
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedMP.name}</h2>
                  {selectedMP.party && <p className="text-xs text-gray-400 mt-0.5">{selectedMP.party}</p>}
                </div>
              </div>
              <button onClick={() => setSelectedMP(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: t(lang, "mymp.colAttendance"), value: `${selectedMP.attendance} / ${TOTAL_SESSIONS}` },
                { label: t(lang, "mymp.colExcused"), value: selectedMP.excused },
                { label: t(lang, "mymp.colUnexcused"), value: selectedMP.unexcused },
                { label: t(lang, "mymp.colDiscussions"), value: selectedMP.discussions },
                { label: t(lang, "mymp.colQuestions"), value: selectedMP.questions },
                { label: t(lang, "mymp.colLaws"), value: selectedMP.laws },
                { label: t(lang, "mymp.colAmendments"), value: selectedMP.amendments },
                { label: t(lang, "mymp.colCommittees"), value: selectedMP.committeesAsMember },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4">Период: {t(lang, "mymp.subtitle")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
