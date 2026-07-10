"use client";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList,
} from "recharts";
import type { Lang } from "../i18n";
import { t } from "../i18n";
import { tName, tParty, tCaseType } from "../i18n/translate";
import ChartDownload from "./ChartDownload";
import activeMPs from "../../public/data/mps_active.json";

// Office-holders whose mandate is active (the 120 roster). Anyone holding a
// contact office who is NOT on this list is a former MP — flagged in the list.
const ACTIVE_MP_NAMES = new Set((activeMPs as { name: string }[]).map(m => m.name));

interface Row {
  mpId: string;
  mpName: string;
  party: string;
  mandate: string;
  category: string;
  subcategory: string;
  total: number;
}

interface Profile {
  name: string;
  party?: string;
  partyLogo?: string | null;
  photo?: string | null;
}

interface Props {
  rows: Row[];
  profiles: Profile[];
  lang: Lang;
}

const TEAL = "#0d9488";
const NAVY = "#1a2e5a";
const COLORS = [NAVY, TEAL, "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#f97316", "#06b6d4", "#84cc16"];

export default function KancelaariiExplorer({ rows, profiles, lang }: Props) {
  const [filterParty, setFilterParty] = useState("all");
  const [filterMP, setFilterMP] = useState("all");
  const [mpPage, setMpPage] = useState(0);
  const MP_PAGE_SIZE = 12;

  const mpMeta = useMemo(() => {
    const map = new Map<string, { photo: string | null; partyLogo: string | null; party: string }>();
    profiles.forEach(p => map.set(p.name, { photo: p.photo ?? null, partyLogo: p.partyLogo ?? null, party: p.party ?? "" }));
    return map;
  }, [profiles]);

  const parties = useMemo(() => ["all", ...Array.from(new Set(rows.map(r => r.party))).sort()], [rows]);
  const allMPs = useMemo(() => {
    const filtered = filterParty === "all" ? rows : rows.filter(r => r.party === filterParty);
    return ["all", ...Array.from(new Set(filtered.map(r => r.mpName))).sort()];
  }, [rows, filterParty]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filterParty !== "all") list = list.filter(r => r.party === filterParty);
    if (filterMP !== "all") list = list.filter(r => r.mpName === filterMP);
    return list;
  }, [rows, filterParty, filterMP]);

  const kpis = useMemo(() => {
    const get = (sub: string) => filtered.filter(r => r.subcategory === sub).reduce((s, r) => s + r.total, 0);
    return {
      cases: get("casesAll"),
      meetings: get("meetingsAll"),
      events: get("eventsAll"),
      initiatives: filtered.filter(r => r.category === "submittedInitiatives").reduce((s, r) => s + r.total, 0),
    };
  }, [filtered]);

  // By MP (casesAll) — full list for ranklist
  const byMP = useMemo(() => {
    const counts: Record<string, { name: string; party: string; total: number }> = {};
    // Seed every office-holder (so the count reflects all offices, even those
    // with zero recorded cases), then fill in case totals.
    filtered.forEach(r => {
      if (!counts[r.mpName]) counts[r.mpName] = { name: r.mpName, party: r.party, total: 0 };
    });
    filtered.filter(r => r.subcategory === "casesAll").forEach(r => {
      counts[r.mpName].total = r.total;
    });
    return Object.values(counts).sort((a, b) => b.total - a.total);
  }, [filtered]);

  // By case type
  const byCaseType = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.filter(r => r.category === "cases by case category").forEach(r => {
      counts[r.subcategory] = (counts[r.subcategory] || 0) + r.total;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name: tCaseType(lang, name), value }));
  }, [filtered, lang]);

  // By citizen age group (fixed order, low→high)
  const byAge = useMemo(() => {
    const order = ["18-25", "25-35", "35-45", "45-55", "55-65", "65+"];
    const counts: Record<string, number> = {};
    filtered.filter(r => r.category === "cases by age category").forEach(r => {
      counts[r.subcategory] = (counts[r.subcategory] || 0) + r.total;
    });
    return order
      .filter(a => counts[a] !== undefined)
      .map(name => ({ name, value: counts[name] }));
  }, [filtered]);

  // By party (casesAll) with logo
  const byParty = useMemo(() => {
    const counts: Record<string, { total: number; logo: string | null }> = {};
    filtered.filter(r => r.subcategory === "casesAll").forEach(r => {
      const meta = mpMeta.get(r.mpName);
      if (!counts[r.party]) counts[r.party] = { total: 0, logo: meta?.partyLogo ?? null };
      counts[r.party].total += r.total;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, { total, logo }]) => ({ name, total, logo }));
  }, [filtered, mpMeta]);

  // By gender
  const byGender = useMemo(() => {
    const male = filtered.filter(r => r.category === "cases by gender" && r.subcategory === "Машки").reduce((s, r) => s + r.total, 0);
    const female = filtered.filter(r => r.category === "cases by gender" && r.subcategory === "Женски").reduce((s, r) => s + r.total, 0);
    return [
      { name: t(lang, "offices.male"), value: male },
      { name: t(lang, "offices.female"), value: female },
    ];
  }, [filtered, lang]);

  function downloadCSV() {
    const header = [t(lang, "mymp.colMP"), t(lang, "common.party"), t(lang, "common.category"), t(lang, "common.subcategory"), t(lang, "common.total")];
    const csvRows = filtered.map(r => [r.mpName, r.party, r.category, r.subcategory, r.total]);
    const csv = [header, ...csvRows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "kancelarii.csv"; a.click();
  }

  const maxMP = byMP[0]?.total || 1;
  const maxParty = byParty[0]?.total || 1;

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <span className="text-sm font-medium text-gray-600">{t(lang, "common.filter")}:</span>
        <select
          value={filterParty}
          onChange={e => { setFilterParty(e.target.value); setFilterMP("all"); setMpPage(0); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          aria-label={t(lang, "common.filterByParty")}
        >
          <option value="all">{t(lang, "common.allParties")}</option>
          {parties.slice(1).map(p => <option key={p} value={p}>{tParty(lang, p)}</option>)}
        </select>
        <select
          value={filterMP}
          onChange={e => { setFilterMP(e.target.value); setMpPage(0); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          aria-label={t(lang, "common.filterByMP")}
        >
          <option value="all">{t(lang, "common.allMPs")}</option>
          {allMPs.slice(1).map(m => <option key={m} value={m}>{tName(lang, m)}</option>)}
        </select>
        <button onClick={downloadCSV} className="ml-auto text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
          {t(lang, "common.downloadCSV")}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t(lang, "offices.kpiCases"), value: kpis.cases, color: NAVY },
          { label: t(lang, "offices.kpiMeetings"), value: kpis.meetings, color: TEAL },
          { label: t(lang, "offices.kpiEvents"), value: kpis.events, color: TEAL },
          { label: t(lang, "offices.kpiInitiatives"), value: kpis.initiatives, color: NAVY },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500 font-medium">{label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color }}>{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* By MP — photo ranklist with pagination */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-800">{t(lang, "offices.chartByMP")}</h2>
          <span className="text-xs text-gray-400">{byMP.length} {t(lang, "common.mpsLower")}</span>
        </div>
        <div className="space-y-3">
          {byMP.slice(mpPage * MP_PAGE_SIZE, (mpPage + 1) * MP_PAGE_SIZE).map((mp, i) => {
            const globalRank = mpPage * MP_PAGE_SIZE + i;
            const meta = mpMeta.get(mp.name);
            const pct = (mp.total / maxMP) * 100;
            return (
              <div key={mp.name} className="flex items-center gap-4">
                <span className="text-xs font-bold text-gray-400 w-5 text-right shrink-0">{globalRank + 1}</span>
                {meta?.photo
                  ? <img src={meta.photo} alt={mp.name} className="w-9 h-9 rounded-full object-cover object-top bg-gray-100 shrink-0" loading="lazy" />
                  : <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0 text-gray-500 text-sm font-bold">{mp.name[0]}</div>
                }
                {meta?.partyLogo
                  ? <img src={meta.partyLogo} alt={mp.party} className="w-6 h-6 object-contain shrink-0" loading="lazy" />
                  : <span className="w-6 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate">{tName(lang, mp.name)}</span>
                      {!ACTIVE_MP_NAMES.has(mp.name) && (
                        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                          {t(lang, "offices.formerMP")}
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-bold ml-3 shrink-0" style={{ color: globalRank === 0 ? NAVY : TEAL }}>{mp.total}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: globalRank === 0 ? NAVY : TEAL }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{tParty(lang, mp.party)}</p>
                </div>
              </div>
            );
          })}
        </div>
        {byMP.length > MP_PAGE_SIZE && (
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
            <button
              onClick={() => setMpPage(p => Math.max(0, p - 1))}
              disabled={mpPage === 0}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← {t(lang, "common.prev")}
            </button>
            <span className="text-xs text-gray-500">
              {mpPage * MP_PAGE_SIZE + 1}–{Math.min((mpPage + 1) * MP_PAGE_SIZE, byMP.length)} {t(lang, "common.of")} {byMP.length}
            </span>
            <button
              onClick={() => setMpPage(p => Math.min(Math.ceil(byMP.length / MP_PAGE_SIZE) - 1, p + 1))}
              disabled={(mpPage + 1) * MP_PAGE_SIZE >= byMP.length}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {t(lang, "common.next")} →
            </button>
          </div>
        )}
      </div>

      {/* By case type — horizontal bar */}
      <div id="viz-cases-by-type" className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-5">
          <h2 className="font-semibold text-gray-800">{t(lang, "offices.chartByType")}</h2>
          <ChartDownload
            targetId="viz-cases-by-type"
            csv={{ headers: [t(lang, "offices.chartByType"), t(lang, "offices.kpiCases")],
                   rows: byCaseType.map(d => [d.name, d.value]) }}
            filename="slucai-po-tip"
            lang={lang}
          />
        </div>
        <ResponsiveContainer width="100%" height={Math.max(200, byCaseType.length * 36)}>
          <BarChart data={byCaseType} layout="vertical" margin={{ left: 8, right: 36, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={220} />
            <Tooltip />
            <Bar dataKey="value" fill={NAVY} radius={[0, 4, 4, 0]}>
              {byCaseType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              <LabelList dataKey="value" position="right" fontSize={11} fill="#374151" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* By party — logo ranklist */}
      <div id="viz-offices-party" className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-5">
          <h2 className="font-semibold text-gray-800">{t(lang, "offices.chartByParty")}</h2>
          <ChartDownload
            targetId="viz-offices-party"
            csv={{ headers: [t(lang, "common.filterByParty"), t(lang, "offices.kpiCases")],
                   rows: byParty.map(p => [p.name, p.total]) }}
            filename="slucai-po-partija"
            lang={lang}
          />
        </div>
        <div className="space-y-3">
          {byParty.map((p, i) => {
            const pct = (p.total / maxParty) * 100;
            return (
              <div key={p.name} className="flex items-center gap-4">
                <span className="text-xs font-bold text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                {p.logo
                  ? <img src={p.logo} alt={p.name} className="w-8 h-8 object-contain shrink-0" loading="lazy" />
                  : <div className="w-8 h-8 rounded bg-gray-200 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">{tParty(lang, p.name)}</span>
                    <span className="text-sm font-bold ml-3 shrink-0" style={{ color: i === 0 ? NAVY : TEAL }}>{p.total}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: i === 0 ? NAVY : TEAL }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Citizen demographics — age + gender, side by side at the end */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* By age group — vertical columns */}
        <div id="viz-offices-age" className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-semibold text-gray-800">{t(lang, "offices.chartByAge")}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{t(lang, "offices.chartByAgeNote")}</p>
            </div>
            <ChartDownload
              targetId="viz-offices-age"
              csv={{ headers: [t(lang, "offices.chartByAge"), t(lang, "offices.kpiCases")],
                     rows: byAge.map(d => [d.name, d.value]) }}
              filename="slucai-po-vozrast"
              lang={lang}
            />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byAge} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill={TEAL} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="value" position="top" fontSize={11} fill="#374151" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By gender — pie + totals */}
        <div id="viz-offices-gender" className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between mb-5">
            <h2 className="font-semibold text-gray-800">{t(lang, "offices.chartByGender")}</h2>
            <ChartDownload
              targetId="viz-offices-gender"
              csv={{ headers: [t(lang, "offices.chartByGender"), t(lang, "offices.kpiCases")],
                     rows: byGender.map(d => [d.name, d.value]) }}
              filename="slucai-po-pol"
              lang={lang}
            />
          </div>
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart margin={{ top: 16, right: 8, bottom: 8, left: 8 }}>
                <Pie
                  data={byGender}
                  cx="50%"
                  cy="50%"
                  outerRadius={72}
                  dataKey="value"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={(props: any) => `${props.name} ${Math.round((props.percent ?? 0) * 100)}%`}
                >
                  {byGender.map((_, i) => <Cell key={i} fill={i === 0 ? NAVY : TEAL} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-10 mt-1">
              {byGender.map((g, i) => (
                <div key={g.name} className="text-center">
                  <p className="text-xs text-gray-500 font-medium">{g.name}</p>
                  <p className="text-3xl font-bold mt-0.5" style={{ color: i === 0 ? NAVY : TEAL }}>{g.value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
