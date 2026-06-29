"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Lang } from "../i18n";
import { t } from "../i18n";

interface Office {
  id: number;
  address: string;
  lat: number;
  lon: number;
}

interface Props {
  offices: Office[];
  lang: Lang;
}

export default function OfficeMap({ offices, lang }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<unknown>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    import("leaflet").then(L => {
      // Markers below use a custom divIcon, so Leaflet's default PNG marker icons
      // are never needed — no external image dependency.
      const map = L.map(mapRef.current!).setView([41.6, 21.7], 8);
      mapInstance.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:12px;height:12px;background:#0d9488;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      offices.forEach(office => {
        L.marker([office.lat, office.lon], { icon })
          .addTo(map)
          .bindPopup(`<strong>${t(lang, "map.popupTitle")}</strong><br/>${office.address}`);
      });
    });

    return () => {
      if (mapInstance.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapInstance.current as any).remove();
        mapInstance.current = null;
      }
    };
  }, [offices, lang]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="font-semibold text-gray-800">{t(lang, "map.title")}</h2>
        <p className="text-sm text-gray-400 mt-0.5">{offices.length} {t(lang, "map.locatedSuffix")}</p>
      </div>
      <div ref={mapRef} style={{ height: "380px", width: "100%" }} />
    </div>
  );
}
