"use client";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, LabelList,
} from "recharts";
import type { Lang } from "../i18n";
import { t } from "../i18n";
import { tName, tParty, partyAcr, tInst } from "../i18n/translate";
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

interface QTrans { q?: { al: string; en: string }; a?: { al: string; en: string } }

interface Props {
  questions: Question[];
  lang: Lang;
  qi18n?: Record<string, QTrans>;
}

const TEAL = "#0d9488";
const NAVY = "#1a2e5a";
const ANSWERED_COLOR = "#0d9488";
const PENDING_COLOR = "#f59e0b";

// "YYYY-MM-DD" → "DD.MM.YY" (compact, for axis ticks)
function fmtDateShort(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y.slice(2)}`;
}
// "YYYY-MM-DD" → "DD.MM.YYYY" (full, for tooltip)
function fmtDateFull(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
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

// Compact institution label for chart Y-axes, per language. MK uses the
// Cyrillic shortener; AL/EN translate then abbreviate "Ministry/Ministria" → "Min."
function shortInstByLang(lang: Lang, full: string): string {
  if (lang === "mk") return shortInstChart(full);
  return tInst(lang, full)
    .replace(/^Ministria (e|për|i) /, "Min. ")
    .replace(/^Ministry of /, "Min. ");
}

export default function QuestionsExplorer({ questions, lang, qi18n = {} }: Props) {
  // Question/answer bodies are translated by scripts/translate_questions.py into
  // questions_i18n.json; fall back to the original Macedonian where missing.
  const trQ = (q: Question) => (lang === "mk" ? q.question : (qi18n[q.id]?.q?.[lang] ?? q.question));
  const trA = (q: Question) => (lang === "mk" ? q.answer : (qi18n[q.id]?.a?.[lang] ?? q.answer));
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
      if (s && !q.question.toLowerCase().includes(s) && !q.fromMP.toLowerCase().includes(s)
          && !tName(lang, q.fromMP).toLowerCase().includes(s)
          && !trQ(q).toLowerCase().includes(s)) return false;
      return true;
    });
  }, [questions, search, filterMP, filterParty, filterStatus, lang]);

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
    const counts: Record<string, { answered: number; pending: number; full: string | null }> = {};
    questions.forEach(q => {
      const full = q.toInstitution;
      const key = full ?? "__null__";
      if (!counts[key]) counts[key] = { answered: 0, pending: 0, full };
      if (q.status === "Одговорено") counts[key].answered++;
      else counts[key].pending++;
    });
    return Object.values(counts)
      .sort((a, b) => (b.answered + b.pending) - (a.answered + a.pending))
      .slice(0, 12)
      .map(v => ({
        name: v.full ? shortInstByLang(lang, v.full) : t(lang, "questions.nullInstitution"),
        answered: v.answered, pending: v.pending, total: v.answered + v.pending,
      }));
  }, [questions, lang]);

  // Institution answer rate — sorted worst first (journalist view)
  const byInstAnswerRate = useMemo(() => {
    const counts: Record<string, { answered: number; total: number; full: string | null }> = {};
    questions.forEach(q => {
      const full = q.toInstitution;
      const key = full ?? "__null__";
      if (!counts[key]) counts[key] = { answered: 0, total: 0, full };
      counts[key].total++;
      if (q.status === "Одговорено") counts[key].answered++;
    });
    return Object.values(counts)
      .filter(v => v.total >= 3)
      .map(v => ({
        name: v.full ? (lang === "mk" ? shortInst(v.full) : tInst(lang, v.full)) : t(lang, "questions.nullInstitution"),
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

  // Timeline by session (carry a representative sitting date per session)
  const bySession = useMemo(() => {
    const counts: Record<number, { count: number; date: string | null }> = {};
    questions.forEach(q => {
      if (!q.session) return;
      if (!counts[q.session]) counts[q.session] = { count: 0, date: q.date };
      counts[q.session].count++;
      if (!counts[q.session].date && q.date) counts[q.session].date = q.date;
    });
    return Object.entries(counts)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([session, v]) => ({ sessionNum: Number(session), session: `С${session}`, count: v.count, date: v.date }));
  }, [questions]);

  const sessionDate = useMemo(() => {
    const m = new Map<number, string | null>();
    bySession.forEach(s => m.set(s.sessionNum, s.date));
    return m;
  }, [bySession]);

  const totalAnswered = questions.filter(q => q.status === "Одговорено").length;
  const totalPending = questions.filter(q => q.status !== "Одговорено").length;
  const sessions = new Set(questions.map(q => q.session).filter(Boolean)).size;

  function downloadCSV() {
    const header = ["ID", t(lang, "questions.tableDate"), t(lang, "questions.session"), t(lang, "questions.tableFrom"), t(lang, "common.party"), t(lang, "questions.tableTo"), t(lang, "questions.tableQuestion"), t(lang, "questions.tableStatus")];
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
          { label: t(lang, "questions.kpiTotal"), value: questions.length, sub: "" },
          { label: t(lang, "questions.kpiAnswered"), value: totalAnswered, sub: `(${Math.round(totalAnswered / questions.length * 100)}%)` },
          { label: t(lang, "questions.kpiPending"), value: totalPending, sub: "" },
          { label: t(lang, "questions.kpiSessions"), value: sessions, sub: "" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500 font-medium">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {value}{sub && <span className="text-lg font-semibold text-gray-400 ml-1.5">{sub}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Row 1: Top MPs photo list + Institution answer rate — equal halves */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 15 MPs */}
        <div id="viz-questions-mp" className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-800">{t(lang, "questions.chartByMP")}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{mpsByQuestions.length} {t(lang, "mymp.kpiMPs").toLowerCase()}</span>
              <ChartDownload
                targetId="viz-questions-mp"
                csv={{ headers: [t(lang, "questions.tableFrom"), t(lang, "questions.kpiTotal")],
                       rows: mpsByQuestions.map(m => [m.name, m.count]) }}
                filename="prasanja-po-pratenik"
                lang={lang}
              />
            </div>
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
                        <p className="text-sm font-medium text-gray-900 truncate leading-tight">{tName(lang, mp.name)}</p>
                        {mp.party && <p className="text-xs text-gray-400 truncate">{tParty(lang, mp.party)}</p>}
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
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100" data-html2canvas-ignore="true">
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
        <div id="viz-answer-rate" className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-800 mb-1">{t(lang, "questions.chartAnswerRate")}</h2>
              <p className="text-xs text-gray-400">{t(lang, "questions.chartAnswerRateNote")}</p>
            </div>
            <ChartDownload
              targetId="viz-answer-rate"
              csv={{ headers: [t(lang, "questions.tableTo"), t(lang, "common.answered"), t(lang, "common.total"), t(lang, "questions.chartAnswerRate")],
                     rows: byInstAnswerRate.map(d => [d.name, d.answered, d.total, `${d.rate}%`]) }}
              filename="stapka-na-odgovaranje"
              lang={lang}
            />
          </div>
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
      <div id="viz-answered-pending" className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-semibold text-gray-800">{t(lang, "questions.chartAnsweredVsPending")}</h2>
          <ChartDownload
            targetId="viz-answered-pending"
            csv={{ headers: [t(lang, "questions.tableTo"), t(lang, "common.answered"), t(lang, "common.pending")],
                   rows: byInst.map(d => [d.name, d.answered, d.pending]) }}
            filename="prasanja-po-institucija"
            lang={lang}
          />
        </div>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={byInst} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={200} />
            <Tooltip />
            <Legend />
            <Bar dataKey="answered" name={t(lang, "common.answered")} stackId="a" fill={ANSWERED_COLOR}>
              <LabelList dataKey="answered" position="center" fill="#fff" fontSize={11}
                formatter={(v: number) => (v > 0 ? v : "")} />
            </Bar>
            <Bar dataKey="pending" name={t(lang, "common.pending")} stackId="a" fill={PENDING_COLOR} radius={[0, 4, 4, 0]}>
              <LabelList dataKey="pending" position="center" fill="#fff" fontSize={11}
                formatter={(v: number) => (v > 0 ? v : "")} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Row 3: Questions by party — full width, 2-col internal grid for many parties */}
      <div id="viz-questions-party" className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-start justify-between mb-1">
            <h2 className="font-semibold text-gray-800">{t(lang, "questions.chartByParty")}</h2>
            <ChartDownload
              targetId="viz-questions-party"
              csv={{ headers: [t(lang, "common.party"), t(lang, "common.total"), t(lang, "common.answered"), t(lang, "common.pending")],
                     rows: byParty.map(p => [p.name, p.total, p.answered, p.pending]) }}
              filename="prasanja-po-partija"
              lang={lang}
            />
          </div>
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
                        <span className="text-sm font-medium text-gray-800 flex-1 leading-tight truncate">{tParty(lang, p.name)}</span>
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
      <div id="viz-timeline" className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-semibold text-gray-800">{t(lang, "questions.chartTimeline")}</h2>
          <ChartDownload
            targetId="viz-timeline"
            csv={{ headers: [t(lang, "common.sessions"), t(lang, "questions.kpiTotal")],
                   rows: bySession.map(d => [d.session, d.count]) }}
            filename="prasanja-po-sednica"
            lang={lang}
          />
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={bySession} margin={{ left: 0, right: 14, top: 4, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="sessionNum"
              interval={2}
              height={54}
              tickMargin={6}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tick={(props: any) => {
                const { x, y, payload, index } = props;
                const d = sessionDate.get(payload.value);
                // stagger dates on alternating ticks so they don't overlap
                const dateDy = index % 2 === 0 ? 24 : 37;
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} fill="#374151">
                      {payload.value}
                    </text>
                    {d && (
                      <text x={0} y={0} dy={dateDy} textAnchor="middle" fontSize={9} fill="#9ca3af">
                        {fmtDateShort(d)}
                      </text>
                    )}
                  </g>
                );
              }}
            />
            <YAxis width={32} tick={{ fontSize: 12 }} />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                    <p className="font-semibold text-gray-800">{t(lang, "questions.sessionFull")} {p.sessionNum}</p>
                    {p.date && <p className="text-gray-500">{fmtDateFull(p.date)}</p>}
                    <p className="text-gray-700 mt-1">{p.count} {t(lang, "questions.questionsShort")}</p>
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey="count" stroke={NAVY} strokeWidth={2} dot={{ r: 3, fill: NAVY }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* AI-translation disclaimer (AL/EN only — question bodies are machine-translated) */}
      {lang !== "mk" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2 items-start" role="note">
          <span aria-hidden="true">⌁</span>
          <p>{t(lang, "questions.aiTranslationNotice")}</p>
        </div>
      )}

      {/* Filters + table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <input
            type="search"
            placeholder={t(lang, "common.search")}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-52 focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-label={t(lang, "common.search")}
          />
          <select
            value={filterMP}
            onChange={e => { setFilterMP(e.target.value); setPage(0); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-auto sm:max-w-[14rem] min-w-0 focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-label={t(lang, "common.filterByMP")}
          >
            <option value="all">{t(lang, "common.allMPs")}</option>
            {allMPs.slice(1).map(mp => <option key={mp} value={mp}>{tName(lang, mp)}</option>)}
          </select>
          {allParties.length > 2 && (
            <select
              value={filterParty}
              onChange={e => { setFilterParty(e.target.value); setPage(0); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-auto sm:max-w-[14rem] min-w-0 focus:outline-none focus:ring-2 focus:ring-teal-500"
              aria-label={t(lang, "common.filterByParty")}
            >
              <option value="all">{t(lang, "common.allParties")}</option>
              {allParties.slice(1).map(p => <option key={p} value={p}>{tParty(lang, p)}</option>)}
            </select>
          )}
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-auto sm:max-w-[14rem] min-w-0 focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-label={t(lang, "common.filterByStatus")}
          >
            <option value="all">{t(lang, "common.filterByStatus")}</option>
            <option value="Одговорено">{t(lang, "common.answered")}</option>
            <option value="Доставено">{t(lang, "common.pending")}</option>
          </select>
          <div className="flex flex-col items-start sm:items-end gap-1.5 ml-auto">
            <div className="flex gap-2">
              <button onClick={downloadCSV} className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                {t(lang, "common.downloadCSV")}
              </button>
              <button onClick={downloadJSON} className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                {t(lang, "common.downloadJSON")}
              </button>
            </div>
            <span className="text-sm text-gray-500">{filtered.length} {t(lang, "common.results")}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="grid">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">{t(lang, "questions.tableFrom")}</th>
                <th className="px-4 py-3 text-left">{t(lang, "common.party")}</th>
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
                  aria-label={`${t(lang, "questions.openDetailAria")} ${q.fromMP}`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{tName(lang, q.fromMP)}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <span className="text-gray-600 font-medium">{partyAcr(lang, q.party)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">
                    {q.toInstitution ? tInst(lang, q.toInstitution) : <span className="text-gray-400 italic">{t(lang, "questions.nullInstitution")}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{trQ(q)}</td>
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
                  <p className="font-semibold text-gray-900">{tName(lang, selected.fromMP)}</p>
                  {selected.party && <p className="text-xs text-gray-400">{tParty(lang, selected.party)}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    → {selected.toInstitution ? tInst(lang, selected.toInstitution) : (selected.toUser || t(lang, "questions.nullInstitution"))}
                    {selected.date ? ` · ${selected.date}` : ""}
                    {selected.session ? ` · ${t(lang, "questions.session")} ${selected.session}` : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-2 shrink-0"
                aria-label={t(lang, "common.close")}
              >×</button>
            </div>

            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                {t(lang, "questions.detailQuestion")}
                {lang !== "mk" && qi18n[selected.id]?.q && (
                  <span className="normal-case font-normal text-[10px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">⌁ {t(lang, "questions.autoTranslated")}</span>
                )}
              </p>
              <p className="text-gray-900 leading-relaxed">{trQ(selected)}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                {t(lang, "questions.detailAnswer")}
                {lang !== "mk" && qi18n[selected.id]?.a && (
                  <span className="normal-case font-normal text-[10px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">⌁ {t(lang, "questions.autoTranslated")}</span>
                )}
              </p>
              {selected.answerIsCopy
                ? <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 italic">
                    {t(lang, "questions.detailNoAnswerSource")}
                  </p>
                : selected.answer
                  ? <p className="text-gray-700 leading-relaxed">{trA(selected)}</p>
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
