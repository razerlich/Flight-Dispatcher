"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { greatCirclePoints, splitAtAntimeridian } from "@/app/lib/geo";

// ── Auto-fit map to both markers ──────────────────────────────────────────────
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48] });
    }
  }, [map, points]);
  return null;
}

// ── Custom dot markers (avoids Leaflet webpack icon bug) ──────────────────────
function dotIcon(color: string) {
  return L.divIcon({
    html: `<div style="
      width:14px;height:14px;
      background:${color};
      border:2.5px solid #fff;
      border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,.6)
    "></div>`,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

const originIcon = dotIcon("#6366f1"); // indigo
const destIcon   = dotIcon("#ef4444"); // red

// ── Props ─────────────────────────────────────────────────────────────────────
export type FlightMapProps = {
  originLat: number;
  originLon: number;
  originIcao: string;
  originCity?: string;
  destLat: number;
  destLon: number;
  destIcao: string;
  destCity?: string;
  flightNumber?: string;
  onClose: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function FlightMap({
  originLat, originLon, originIcao, originCity,
  destLat,   destLon,   destIcao,   destCity,
  flightNumber,
  onClose,
}: FlightMapProps) {
  const arc = greatCirclePoints(originLat, originLon, destLat, destLon);
  const fitPoints: [number, number][] = [[originLat, originLon], [destLat, destLon]];

  return (
    <div className="overflow-hidden border-t border-indigo-900/60">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900 px-4 py-2">
        <span className="font-mono text-sm text-slate-200">
          <span className="text-indigo-400">{originIcao}</span>
          {" → "}
          <span className="text-red-400">{destIcao}</span>
          {flightNumber && (
            <span className="ml-3 text-slate-400">· {flightNumber}</span>
          )}
        </span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-100 text-lg leading-none px-1"
          title="Close map"
        >
          ✕
        </button>
      </div>

      {/* Map */}
      <div style={{ height: 380 }}>
        <MapContainer
          center={[0, 0]}
          zoom={3}
          style={{ height: "100%", width: "100%" }}
          zoomControl
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
            subdomains="abcd"
            maxZoom={19}
          />

          <Marker position={[originLat, originLon]} icon={originIcon}>
            <Popup>
              <strong>{originIcao}</strong>
              {originCity && <><br />{originCity}</>}
            </Popup>
          </Marker>

          <Marker position={[destLat, destLon]} icon={destIcon}>
            <Popup>
              <strong>{destIcao}</strong>
              {destCity && <><br />{destCity}</>}
            </Popup>
          </Marker>

          {/* Great-circle arc — split at antimeridian to avoid the "loop" bug */}
          {splitAtAntimeridian(arc).map((seg, i) => (
            <Polyline
              key={i}
              positions={seg}
              pathOptions={{ color: "#6366f1", weight: 2.5, dashArray: "8 5", opacity: 0.85 }}
            />
          ))}

          <FitBounds points={fitPoints} />
        </MapContainer>
      </div>
    </div>
  );
}
