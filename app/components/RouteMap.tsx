"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { greatCirclePoints, splitAtAntimeridian } from "@/app/lib/geo";

const WORLD_OFFSETS = [-360, 0, 360];

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [48, 48] });
  }, [map, points]);
  return null;
}

function dotIcon(color: string, size = 12) {
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border:2px solid rgba(255,255,255,0.8);
      border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,.7)
    "></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
  });
}

const originIcon = dotIcon("#6366f1", 16);
const destIcon   = dotIcon("#ef4444", 10);

function atcDotIcon() {
  return L.divIcon({
    html: `<div style="
      width:14px;height:14px;
      background:#22c55e;
      border:2px solid rgba(255,255,255,0.9);
      border-radius:50%;
      box-shadow:0 0 8px rgba(34,197,94,0.7),0 2px 6px rgba(0,0,0,.6)
    "></div>`,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -9],
  });
}

export type RouteDestination = {
  lat: number;
  lon: number;
  icao: string;
  city?: string;
  flights: string[];
};

export type RouteMapProps = {
  originLat: number;
  originLon: number;
  originIcao: string;
  originCity?: string;
  destinations: RouteDestination[];
  onDestinationClick?: (icao: string) => void;
  vatsimAtc?: Record<string, string[]>;
};

export default function RouteMap({
  originLat, originLon, originIcao, originCity,
  destinations, onDestinationClick, vatsimAtc = {},
}: RouteMapProps) {
  const [hoveredDest, setHoveredDest] = useState<string | null>(null);

  const allPoints: [number, number][] = [
    [originLat, originLon],
    ...destinations.map((d) => [d.lat, d.lon] as [number, number]),
  ];

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
      {/* Header */}
      <div className="bg-slate-900 px-4 py-2 flex items-center gap-3">
        <span className="text-indigo-400 font-mono font-semibold">{originIcao}</span>
        {originCity && <span className="text-slate-400 text-sm">{originCity}</span>}
        <span className="text-slate-600 text-sm ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span style={{ display:"inline-block", width:10, height:10, background:"#22c55e", borderRadius:"50%", boxShadow:"0 0 5px rgba(34,197,94,0.6)" }} />
            <span className="text-green-500">ATC online</span>
          </span>
          <span>{destinations.length} destination{destinations.length !== 1 ? "s" : ""}</span>
        </span>
      </div>

      {/* Map */}
      <div style={{ height: 500 }}>
        <MapContainer
          center={[originLat, originLon]}
          zoom={3}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
          zoomControl
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
            subdomains="abcd"
            maxZoom={19}
          />

          {/* Arcs — rendered at 3 world copies so dots follow when panning */}
          {WORLD_OFFSETS.map((worldOffset) =>
            destinations.map((d) => {
              const atcPositions = vatsimAtc[d.icao] ?? [];
              const isHovered = hoveredDest === d.icao;
              const segments = splitAtAntimeridian(
                greatCirclePoints(originLat, originLon, d.lat, d.lon)
              );
              return segments.map((seg, si) => (
                <Polyline
                  key={`${d.icao}-${si}-${worldOffset}`}
                  positions={seg.map(([lat, lon]) => [lat, lon + worldOffset] as [number, number])}
                  pathOptions={{
                    color: "#6366f1",
                    weight: isHovered ? 4 : 2,
                    opacity: isHovered ? 0.9 : 0.5,
                    dashArray: isHovered ? "" : "6 4",
                  }}
                  eventHandlers={{
                    click:     () => onDestinationClick?.(d.icao),
                    mouseover: () => setHoveredDest(d.icao),
                    mouseout:  () => setHoveredDest(null),
                  }}
                >
                  <Tooltip sticky>
                    <div style={{ minWidth: 120 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {originIcao} → {d.icao}
                      </div>
                      {d.city && (
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{d.city}</div>
                      )}
                      {d.flights.length > 0 && (
                        <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4 }}>
                          {d.flights.join("  ·  ")}
                        </div>
                      )}
                      {atcPositions.length > 0 && (
                        <div style={{ fontSize: 11, color: "#22c55e", marginTop: 4 }}>
                          ATC: {atcPositions.join(" · ")}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: "#6366f1", marginTop: 5 }}>
                        Click to jump to flight
                      </div>
                    </div>
                  </Tooltip>
                </Polyline>
              ));
            })
          )}

          {/* Origin — 3 world copies */}
          {WORLD_OFFSETS.map((worldOffset) => (
            <Marker key={`origin-${worldOffset}`} position={[originLat, originLon + worldOffset]} icon={originIcon}>
              <Popup>
                <strong>{originIcao}</strong>
                {originCity && <><br />{originCity}</>}
              </Popup>
            </Marker>
          ))}

          {/* Destinations — 3 world copies */}
          {WORLD_OFFSETS.map((worldOffset) =>
            destinations.map((d) => {
              const positions = vatsimAtc[d.icao] ?? [];
              const hasAtc = positions.length > 0;
              return (
                <Marker
                  key={`${d.icao}-${worldOffset}`}
                  position={[d.lat, d.lon + worldOffset]}
                  icon={hasAtc ? atcDotIcon() : destIcon}
                >
                  <Popup>
                    <strong>{d.icao}</strong>
                    {d.city && <><br />{d.city}</>}
                    {d.flights.length > 0 && (
                      <><br /><span style={{ fontSize: 11, color: "#94a3b8" }}>{d.flights.join(", ")}</span></>
                    )}
                    {hasAtc && (
                      <><br /><span style={{ fontSize: 11, color: "#22c55e" }}>
                        ATC online: {positions.join(" · ")}
                      </span></>
                    )}
                    {onDestinationClick && (
                      <>
                        <br />
                        <button
                          onClick={() => onDestinationClick(d.icao)}
                          style={{
                            marginTop: 6, fontSize: 11, color: "#818cf8",
                            background: "none", border: "none", cursor: "pointer", padding: 0,
                          }}
                        >
                          ↓ View in list
                        </button>
                      </>
                    )}
                  </Popup>
                </Marker>
              );
            })
          )}

          <FitBounds points={allPoints} />
        </MapContainer>
      </div>
    </div>
  );
}
