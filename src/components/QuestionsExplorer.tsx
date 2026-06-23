"use client";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import type { Lang } from "../i18n";
import { t } from "../i18n";
import ChartDownload from "./ChartDownload";

interface Question {
  id: string;
  date: string | null;
  session: number | null;
  fromMP: string;
  mpActive?: boolean;
  party?: string;
  partyLogo?: string | null;
  mpPhoto?: string | null;
  toInstitution: string | null;
  toUser: string | null;
  question: string;
  status: string;
  answer: string;
  answerIsCopy: boolean;
}

interface Props {
  questions: Question[];
  lang: Lang;
}

const TEAL = "#0d9488";
const NAVY = "#1a2e5a";
const ANSWERED_COLOR = "#0d9488";
const PENDING_COLOR = "#f59e0b";

const PARTY_ACRONYM: Record<string, string> = {
  "Социјалдемократски сојуз на Македонија": "СДСМ",
  "ВМРО-ДПМНЕ": "ВМРО-ДПМНЕ",
  "Демократска унија за интеграција": "ДУИ",
  "Левица": "Левица",
  "Алијанса за Албанците": "АзА",
  "Движење на Турците на Македонија за правда и демократија": "ДТМ",
  "Движење БЕСА": "БЕСА",
  "Нова социјалдемократска партија": "НСДП",
  "Либерално-демократска партија": "ЛДП",
  "Независни пратеници": "Независни",
  "Движење ЗНАМ": "ЗНАМ",
  "Социјалистичка партија на Македонија": "СПМ",
  "Алтернатива": "Алт.",
  "Демократска партија на Албанците": "ДПА",
  "Демократско движење": "Дем. движ.",
  "Турска демократска партија": "ТДП",
  "Демократска партија на Србите": "ДПС",
  "ВЛЕН": "ВЛЕН",
};

function partyAcronym(party: string | undefined): string {
  if (!party) return "—";
  return PARTY_ACRONYM[party] ?? party.split(" ").filter(w => w.length > 2).map(w => w[0]).join("").toUpperCase().slice(0, 5);
}

function shortInst(name: string): string {
  return name
    .replace("Министерство за ", "Мин. ")
    .replace("Министерството за ", "Мин. ")
    .replace("Претседател на Владата на Република Северна Македонија", "Претседател на Влада")
    .replace("Влада на Република Северна Македонија", "Влада на РСМ");
}

// More aggressive shortening for chart Y-axis labels where space is tight
function shortInstChart(name: string): string {
  return shortInst(name)
    .replace(" и надворешна трговија", "")
    .replace(" и просторно планирање", "")
    .replace(", демографија и млади", "")
    .replace(" и наука", "")
    .replace(" и туризам", "")
    .replace(" и труд", "");
}

export default function QuestionsExplorer({ questions, lang }: Props) {
  const [search, setSearch] = useState("");
  const [filterMP, setFilterMP] = useState("all");
  const [filterParty, setFilterParty] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState<Question | null>(null);
  const [page, setPage] = useState(0);
  const [mpPage, setMpPage] = useState(0);
  const MP_PAGE_SIZE = 15;
  const PAGE_SIZE = 20;

  const allMPs = useMemo(() =>
    ["all", ...Array.from(new Set(questions.map(q => q.fromMP))).sort()], [questions]);

  const allParties = useMemo(() =>
    ["all", ...Array.from(new Set(questions.map(q => q.party || "").filter(Boolean))).sort()],
    [questions]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return questions.filter(q => {
      if (filterMP !== "all" && q.fromMP !== filterMP) return false;
      if (filterParty !== "all" && q.party !== filterParty) return false;
      if (filterStatus !== "all" && q.status !== filterStatus) return false;
      if (s && !q.question.toLowerCase().includes(s) && !q.fromMP.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [questions, search, filterMP, filterParty, filterStatus]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageSlice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // MPs ranked by number of questions. Scoped to the active assembly; questions
  // from MPs who have since left remain in the record but not in MP rankings.
  const mpsByQuestions = useMemo(() => {
    const counts: Record<string, { count: number; photo?: string | null; party?: string }> = {};
    questions.forEach(q => {
      if (q.mpActive === false) return;
      if (!counts[q.fromMP]) counts[q.fromMP] = { count: 0, photo: q.mpPhoto, party: q.party };
      counts[q.fromMP].count++;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, data]) => ({ name, ...data }));
  }, [questions]);

  const visibleMPs = mpsByQuestions.slice(mpPage * MP_PAGE_SIZE, (mpPage + 1) * MP_PAGE_SIZE);

  // Institution answered vs pending (top 12 by volume)
  const byInst = useMemo(() => {
    const counts: Record<string, { answered: number; pending: number }> = {};
    questions.forEach(q => {
      const inst = shortInstChart(q.toInstitution || t(lang, "questions.nullInstitution"));
      if (!counts[inst]) counts[inst] = { answered: 0, pending: 0 };
      if (q.status === "Одговорено") counts[inst].answered++;
      else counts[inst].pending++;
    });
    return Object.entries(counts)
      .sort((a, b) => (b[1].answered + b[1].pending) - (a[1].answered + a[1].pending))
      .slice(0, 12)
      .map(([name, v]) => ({ name, ...v, total: v.answered + v.pending }));
  }, [questions, lang]);

  // Institution answer rate — sorted worst first (journalist view)
  const byInstAnswerRate = useMemo(() => {
    const counts: Record<string, { answered: number; total: number }> = {};
    questions.forEach(q => {
      const inst = shortInst(q.toInstitution || t(lang, "questions.nullInstitution"));
      if (!counts[inst]) counts[inst] = { answered: 0, total: 0 };
      counts[inst].total++;
      if (q.status === "Одговорено") counts[inst].answered++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v.total >= 3)
      .map(([name, v]) => ({
        name,
        rate: Math.round((v.answered / v.total) * 100),
        answered: v.answered,
        total: v.total,
      }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 14);
  }, [questions, lang]);

  // Questions by party group
  const byParty = useMemo(() => {
    const data: Record<string, { answered: number; pending: number; logo?: string | null }> = {};
    questions.forEach(q => {
      const party = q.party || "";
      if (!party) return;
      if (!data[party]) data[party] = { answered: 0, pending: 0, logo: q.partyLogo };
      if (q.status === "Одговорено") data[party].answered++;
      else data[party].pending++;
    });
    return Object.entries(data)
      .map(([name, v]) => ({ name, ...v, total: v.answered + v.pending }))
      .sort((a, b) => b.total - a.total);
  }, [questions]);

  // Timeline by session
  const bySession = useMemo(() => {
    const counts: Record<number, number> = {};
    questions.forEach(q => {
      if (q.session) counts[q.session] = (counts[q.session] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([session, count]) => ({ session: `С${session}`, count }));
  }, [questions]);

  const totalAnswered = questions.filter(q => q.status === "Одговорено").length;
  const totalPending = questions.filter(q => q.status !== "Одговорено").length;
  const sessions = new Set(questions.map(q => q.session).filter(Boolean)).size;

  function downloadCSV() {
    const header = ["ID", "Датум", "Седница", "Пратеник", "Партија", "Институција", "Прашање", "Статус"];
    const rows = filtered.map(q => [
      q.id, q.date || "", q.session || "", q.fromMP, q.party || "",
      q.toInstitution || "", `"${q.question.replace(/"/g, '""')}"`, q.status,
    ]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "prasanja.csv"; a.click();
  }

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "prasanja.json"; a.click();
  }

  return (
    <div className="space-y-8">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t(lang, "questions.kpiTotal"), value: questions.length },
          { label: t(lang, "questions.kpiAnswered"), value: `${totalAnswered} (${Math.round(totalAnswered / questions.length * 100)}%)` },
          { label: t(lang, "questions.kpiPending"), value: totalPending },
          { label: t(lang, "questions.kpiSessions"), value: sessions },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500 font-medium">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Row 1: Top MPs photo list + Institution answer rate — equal halves */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 15 MPs */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-semibold text-gray-800">{t(lang, "questions.chartByMP")}</h2>
            <span className="text-xs text-gray-400">{mpsByQuestions.length} {t(lang, "mymp.kpiMPs").toLowerCase()}</span>
          </div>
          <div className="space-y-3">
            {visibleMPs.map((mp, idx) => {
              const i = mpPage * MP_PAGE_SIZE + idx;
              const max = mpsByQuestions[0].count;
              const pct = max > 0 ? (mp.count / max) * 100 : 0;
              return (
                <div key={mp.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                  {mp.photo
                    ? <img
                        src={mp.photo}
                        alt={mp.name}
                        className="w-10 h-10 rounded-full object-cover object-top bg-gray-100 shrink-0"
                        loading="lazy"
                      />
                    : <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0 text-gray-500 text-sm font-bold">
                        {mp.name[0]}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-medium text-gray-900 truncate leading-tight">{mp.name}</p>
                        {mp.party && <p className="text-xs text-gray-400 truncate">{mp.party}</p>}
                      </div>
                      <span
                        className="text-sm font-bold shrink-0"
                        style={{ color: i === 0 ? NAVY : TEAL }}
                      >{mp.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: i === 0 ? NAVY : TEAL }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {mpsByQuestions.length > MP_PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={() => setMpPage(p => Math.max(0, p - 1))}
                disabled={mpPage === 0}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >←</button>
              <span className="text-xs text-gray-400">
                {mpPage * MP_PAGE_SIZE + 1}–{Math.min((mpPage + 1) * MP_PAGE_SIZE, mpsByQuestions.length)} {t(lang, "common.of")} {mpsByQuestions.length}
              </span>
              <button
                onClick={() => setMpPage(p => Math.min(Math.ceil(mpsByQuestions.length / MP_PAGE_SIZE) - 1, p + 1))}
                disabled={(mpPage + 1) * MP_PAGE_SIZE >= mpsByQuestions.length}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >→</button>
            </div>
          )}
        </div>

        {/* Institution answer rate */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-1">{t(lang, "questions.chartAnswerRate")}</h2>
          <p className="text-xs text-gray-400 mb-4">{t(lang, "questions.chartAnswerRateNote")}</p>
          <div className="space-y-2.5">
            {byInstAnswerRate.map(inst => {
              const color = inst.rate < 60 ? "#dc2626" : inst.rate < 80 ? PENDING_COLOR : TEAL;
              return (
                <div key={inst.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-700 truncate max-w-[76%] leading-tight">{inst.name}</span>
                    <span className="text-xs font-bold ml-1 shrink-0" style={{ color }}>{inst.rate}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${inst.rate}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 w-12 text-right">{inst.answered}/{inst.total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2: Answered vs Pending stacked bar — full width */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-semibold text-gray-800">{t(lang, "questions.chartAnsweredVsPending")}</h2>
          <ChartDownload
            chartId="chart-answered-pending"
            csv={{ headers: [t(lang, "questions.tableTo"), t(lang, "common.answered"), t(lang, "common.pending")],
                   rows: byInst.map(d => [d.name, d.answered, d.pending]) }}
            filename="prasanja-po-institucija"
            lang={lang}
          />
        </div>
        <div id="chart-answered-pending">
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={byInst} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={200} />
            <Tooltip />
            <Legend />
            <Bar dataKey="answered" name={t(lang, "common.answered")} stackId="a" fill={ANSWERED_COLOR} />
            <Bar dataKey="pending" name={t(lang, "common.pending")} stackId="a" fill={PENDING_COLOR} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Questions by party — full width, 2-col internal grid for many parties */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-1">{t(lang, "questions.chartByParty")}</h2>
          <p className="text-xs text-gray-400 mb-5">{t(lang, "questions.chartByPartyNote")}</p>
          {byParty.length === 0
            ? <p className="text-sm text-gray-400 italic">{t(lang, "common.noData")}</p>
            : (
              <div className="space-y-4">
                {byParty.map(p => {
                  const maxTotal = byParty[0]?.total || 1;
                  const answeredOfMax = (p.answered / maxTotal) * 100;
                  const pendingOfMax = (p.pending / maxTotal) * 100;
                  const answeredPct = p.total > 0 ? (p.answered / p.total) * 100 : 0;
                  const rateColor = answeredPct >= 90 ? ANSWERED_COLOR : answeredPct < 70 ? "#dc2626" : PENDING_COLOR;
                  return (
                    <div key={p.name}>
                      <div className="flex items-center gap-3 mb-1.5">
                        {p.logo
                          ? <img src={p.logo} alt={p.name} className="w-7 h-7 rounded object-contain bg-gray-50 border border-gray-100 shrink-0 p-0.5" loading="lazy" />
                          : <div className="w-7 h-7 rounded bg-gray-200 flex items-center justify-center shrink-0 text-gray-500 text-xs font-bold">{p.name[0]}</div>
                        }
                        <span className="text-sm font-medium text-gray-800 flex-1 leading-tight truncate">{p.name}</span>
                        <span className="text-sm font-bold text-gray-900 shrink-0 ml-2">{p.total}</span>
                        <span className="text-xs text-gray-400 shrink-0">
                          (<span style={{ color: ANSWERED_COLOR }}>{p.answered}</span>
                          {p.pending > 0 && <span> · <span style={{ color: PENDING_COLOR }}>{p.pending}</span></span>})
                        </span>
                        <span className="text-xs font-semibold w-9 text-right shrink-0" style={{ color: rateColor }}>{Math.round(answeredPct)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="flex h-2">
                          <div style={{ width: `${answeredOfMax}%`, backgroundColor: ANSWERED_COLOR }} />
                          <div style={{ width: `${pendingOfMax}%`, backgroundColor: PENDING_COLOR }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>

      {/* Row 4: Timeline — full width */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-semibold text-gray-800">{t(lang, "questions.chartTimeline")}</h2>
          <ChartDownload
            chartId="chart-timeline"
            csv={{ headers: [t(lang, "common.sessions"), t(lang, "questions.kpiTotal")],
                   rows: bySession.map(d => [d.session, d.count]) }}
            filename="prasanja-po-sednica"
            lang={lang}
          />
        </div>
        <div id="chart-timeline">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={bySession}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="session" tick={{ fontSize: 11 }} interval={1} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke={NAVY} strokeWidth={2} dot={{ r: 3, fill: NAVY }} />
          </LineChart>
        </ResponsiveContainer>
        </div>
      </div>

      {/* Filters + table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <input
            type="search"
            placeholder={t(lang, "common.search")}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-label={t(lang, "common.search")}
          />
          <select
            value={filterMP}
            onChange={e => { setFilterMP(e.target.value); setPage(0); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-label={t(lang, "common.filterByMP")}
          >
            <option value="all">{t(lang, "common.allMPs")}</option>
            {allMPs.slice(1).map(mp => <option key={mp} value={mp}>{mp}</option>)}
          </select>
          {allParties.length > 2 && (
            <select
              value={filterParty}
              onChange={e => { setFilterParty(e.target.value); setPage(0); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              aria-label={t(lang, "common.filterByParty")}
            >
              <option value="all">{t(lang, "common.allParties")}</option>
              {allParties.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-label={t(lang, "common.filterByStatus")}
          >
            <option value="all">{t(lang, "common.filterByStatus")}</option>
            <option value="Одговорено">{t(lang, "common.answered")}</option>
            <option value="Доставено">{t(lang, "common.pending")}</option>
          </select>
          <span className="text-sm text-gray-500 ml-auto">{filtered.length} резултати</span>
          <button onClick={downloadCSV} className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
            {t(lang, "common.downloadCSV")}
          </button>
          <button onClick={downloadJSON} className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
            {t(lang, "common.downloadJSON")}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="grid">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">{t(lang, "questions.tableFrom")}</th>
                <th className="px-4 py-3 text-left">{t(lang, "common.filterByParty")}</th>
                <th className="px-4 py-3 text-left">{t(lang, "questions.tableTo")}</th>
                <th className="px-4 py-3 text-left">{t(lang, "questions.tableQuestion")}</th>
                <th className="px-4 py-3 text-left">{t(lang, "questions.tableDate")}</th>
                <th className="px-4 py-3 text-left">{t(lang, "questions.tableStatus")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageSlice.map(q => (
                <tr
                  key={q.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelected(q)}
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && setSelected(q)}
                  aria-label={`Отвори детали за прашање од ${q.fromMP}`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{q.fromMP}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <span className="text-gray-600 font-medium">{partyAcronym(q.party)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">
                    {q.toInstitution || <span className="text-gray-400 italic">{t(lang, "questions.nullInstitution")}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{q.question}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {q.date || <span className="text-gray-400 italic">{t(lang, "questions.nullDate")}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      q.status === "Одговорено"
                        ? "bg-teal-100 text-teal-800"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {q.status === "Одговорено" ? t(lang, "common.answered") : t(lang, "common.pending")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2 justify-end text-sm">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
            >←</button>
            <span className="text-gray-600">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
            >→</button>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t(lang, "questions.detailTitle")}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6">
            {/* MP header */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                {selected.mpPhoto
                  ? <img
                      src={selected.mpPhoto}
                      alt={selected.fromMP}
                      className="w-12 h-12 rounded-full object-cover object-top bg-gray-100 shrink-0"
                    />
                  : <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center shrink-0 text-gray-500 font-bold">
                      {selected.fromMP[0]}
                    </div>
                }
                <div>
                  <p className="font-semibold text-gray-900">{selected.fromMP}</p>
                  {selected.party && <p className="text-xs text-gray-400">{selected.party}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    → {selected.toUser || selected.toInstitution || t(lang, "questions.nullInstitution")}
                    {selected.date ? ` · ${selected.date}` : ""}
                    {selected.session ? ` · Седница ${selected.session}` : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-2 shrink-0"
                aria-label="Затвори"
              >×</button>
            </div>

            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {t(lang, "questions.detailQuestion")}
              </p>
              <p className="text-gray-900 leading-relaxed">{selected.question}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {t(lang, "questions.detailAnswer")}
              </p>
              {selected.answerIsCopy
                ? <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 italic">
                    {t(lang, "questions.detailNoAnswerSource")}
                  </p>
                : selected.answer
                  ? <p className="text-gray-700 leading-relaxed">{selected.answer}</p>
                  : <p className="text-sm text-gray-400 italic">{t(lang, "questions.detailNoAnswer")}</p>
              }
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                selected.status === "Одговорено"
                  ? "bg-teal-100 text-teal-800"
                  : "bg-amber-100 text-amber-800"
              }`}>
                {selected.status === "Одговорено" ? t(lang, "common.answered") : t(lang, "common.pending")}
              </span>
              <span className="text-xs text-gray-400">ID: {selected.id}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
