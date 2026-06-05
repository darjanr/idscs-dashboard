"use client";
import { useEffect, useRef } from "react";

interface Office {
  id: number;
  address: string;
  lat: number;
  lon: number;
}

interface Props {
  offices: Office[];
}

export default function OfficeMap({ offices }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<unknown>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    import("leaflet").then(L => {
      // Fix default marker icons (Leaflet + bundlers issue)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

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
          .bindPopup(`<strong>Канцеларија</strong><br/>${office.address}`);
      });
    });

    return () => {
      if (mapInstance.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapInstance.current as any).remove();
        mapInstance.current = null;
      }
    };
  }, [offices]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="font-semibold text-gray-800">Локации на канцеларии</h2>
        <p className="text-sm text-gray-400 mt-0.5">{offices.length} канцеларии низ Македонија</p>
      </div>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} style={{ height: "380px", width: "100%" }} />
    </div>
  );
}
