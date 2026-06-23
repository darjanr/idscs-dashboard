import { useState } from "react";
import { downloadSvgAsPng, downloadCsv } from "../lib/chartExport";
import { t, type Lang } from "../i18n";

interface Props {
  /** id of the element wrapping the chart's <svg> (for PNG export) */
  chartId?: string;
  /** underlying data for CSV export */
  csv?: { headers: string[]; rows: (string | number)[][] };
  filename: string;
  lang: Lang;
}

export default function ChartDownload({ chartId, csv, filename, lang }: Props) {
  const [open, setOpen] = useState(false);

  const exportPng = () => {
    const el = chartId ? document.getElementById(chartId) : null;
    downloadSvgAsPng(el?.querySelector("svg") ?? null, filename);
    setOpen(false);
  };
  const exportCsv = () => {
    if (csv) downloadCsv(filename, csv.headers, csv.rows);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label={t(lang, "common.download")}
        title={t(lang, "common.download")}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[130px]">
            {chartId && (
              <button onClick={exportPng} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                {t(lang, "common.downloadPNG")}
              </button>
            )}
            {csv && (
              <button onClick={exportCsv} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                {t(lang, "common.downloadCSV")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
