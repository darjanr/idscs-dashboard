// Client-side export helpers — PNG (screenshot of any DOM node) and CSV.

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map(r => r.map(escape).join(",")).join("\n");
  // BOM so Cyrillic opens correctly in Excel
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

// Screenshot a DOM node (chart or HTML visualisation) to a PNG. html2canvas is
// imported lazily so it stays out of the initial bundle.
export async function downloadNodeAsPng(node: HTMLElement | null, filename: string) {
  if (!node) return;
  // html2canvas-pro: maintained fork that supports modern CSS colour functions
  // (oklch/oklab) which Tailwind v4 emits — the original html2canvas throws on them.
  const { default: html2canvas } = await import("html2canvas-pro");
  const canvas = await html2canvas(node, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
  });
  canvas.toBlob(blob => { if (blob) triggerDownload(blob, `${filename}.png`); });
}

function triggerDownload(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
