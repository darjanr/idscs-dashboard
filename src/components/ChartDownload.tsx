import { useState } from "react";
import { downloadNodeAsPng, downloadCsv } from "../lib/chartExport";
import { t, type Lang } from "../i18n";

interface Props {
  /** id of the DOM node to capture as PNG */
  targetId?: string;
  /** underlying data for CSV export */
  csv?: { headers: string[]; rows: (string | number)[][] };
  filename: string;
  lang: Lang;
  /** nudge the menu left when the control sits at the right edge */
  align?: "left" | "right";
}

export default function ChartDownload({ targetId, csv, filename, lang, align = "right" }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const exportPng = async () => {
    setOpen(false);
    if (!targetId) return;
    setBusy(true);
    try {
      await downloadNodeAsPng(document.getElementById(targetId), filename);
    } finally {
      setBusy(false);
    }
  };
  const exportCsv = () => {
    setOpen(false);
    if (csv) downloadCsv(filename, csv.headers, csv.rows);
  };

  return (
    <div className="relative shrink-0" data-html2canvas-ignore="true">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
        aria-label={t(lang, "common.download")}
        title={t(lang, "common.download")}
      >
        {busy ? (
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className={`absolute ${align === "right" ? "right-0" : "left-0"} mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[150px]`}>
            {targetId && (
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
