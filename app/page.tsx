"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useUserSettings } from "@/app/hooks/useUserSettings";
import SettingsPanel from "@/app/components/SettingsPanel";
import type { FlightMapProps } from "./components/FlightMap";

const FlightMap = dynamic(() => import("./components/FlightMap"), { ssr: false });
const RouteMap  = dynamic(() => import("./components/RouteMap"),  { ssr: false });

type SelectedFlight = Omit<FlightMapProps, "onClose">;

type TimeMode = "local" | "airport" | "zulu";

type AirportRecord = {
  lat: number;
  lon: number;
  city: string;
  country: string; // ISO 2-letter, e.g. "IL"
  name: string;
};

/** Normalize AeroDataBox UTC strings ("2026-02-23 21:10" or "...Z") to proper ISO. */
function normalizeUtc(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const t = s.replace(" ", "T");
  return t.endsWith("Z") ? t : t + "Z";
}

function fmtTime(dateISO: string, mode: TimeMode, airportTz?: string, useHour12 = true) {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "—";

  if (mode === "zulu") {
    const time = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      hour12: false
    }).format(d);
    return time + "Z";
  }

  if (mode === "airport" && airportTz) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: airportTz,
      hour12: useHour12
    }).format(d);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: useHour12
  }).format(d);
}

function fmtDue(depISO: string, now: Date): { label: string; color: string } {
  const dep = new Date(depISO);
  const diffMins = Math.round((dep.getTime() - now.getTime()) / 60000);

  if (diffMins < -60) return { label: "departed", color: "text-slate-600" };
  if (diffMins < 0)   return { label: `${Math.abs(diffMins)}m ago`, color: "text-slate-500" };
  if (diffMins < 30)  return { label: `in ${diffMins}m`, color: "text-red-400" };
  if (diffMins < 90)  return { label: `in ${diffMins}m`, color: "text-yellow-400" };
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  return { label: `in ${h}h${m > 0 ? ` ${m}m` : ""}`, color: "text-slate-400" };
}

function dayNightIcon(dateISO: string, tz?: string): string {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "";
  const hourStr = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: tz ?? undefined
  }).format(d);
  const hour = parseInt(hourStr, 10) % 24;
  return hour >= 6 && hour < 20 ? "☀️" : "🌙";
}

function minsToHMM(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estFlightMins(km: number): number {
  // ~480 kt average (~889 km/h) + 30 min overhead for climb/descent
  return Math.round((km / 889) * 60) + 30;
}

function estArrISO(depISO: string, mins: number): string {
  return new Date(new Date(depISO).getTime() + mins * 60000).toISOString();
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function fmtSimbriefDate(depISO: string): string {
  const d = new Date(depISO);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} - ${hh}:${mm}`;
}

function simbriefLink(
  orig: string,
  dest: string,
  depISO?: string,
  mins?: number | null,
  airlineIcao?: string,
  flightNumber?: string,
  baseType?: string,
  airframeId?: string,
) {
  const u = new URL("https://dispatch.simbrief.com/options/custom");

  u.searchParams.set("orig", orig);
  u.searchParams.set("dest", dest);

  // Airline ICAO and flight number (digits only, e.g. "UA 91" → "91")
  if (airlineIcao) u.searchParams.set("airline", airlineIcao);
  if (flightNumber) {
    const digits = flightNumber.replace(/^[A-Z0-9]{2,3}\s*/i, "");
    if (digits) u.searchParams.set("fltnum", digits);
  }

  if (baseType)   u.searchParams.set("basetype", baseType);
  if (airframeId) u.searchParams.set("type", airframeId);

  if (depISO) {
    u.searchParams.set("date", fmtSimbriefDate(depISO));
  }

  if (mins && mins > 0) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    u.searchParams.set("stehour", String(h * 3600));
    u.searchParams.set("stemin", String(m * 60));
  }

  return u.toString();
}

type Row = {
  dest: string;
  destCity?: string;
  destCountry?: string; // ISO code, e.g. "GB"
  destTz?: string;
  number?: string;
  airlineName?: string;
  airlineIcao?: string;
  dep?: string;
  arr?: string;          // real scheduled arrival UTC (withLeg=true)
  estMins: number | null; // haversine fallback when arr is missing
};

type FlightEntry = {
  departure?: {
    scheduledTime?: { utc?: string; local?: string };
    terminal?: string;
  };
  arrival?: {
    airport?: { icao?: string; iata?: string; countryCode?: string; timeZone?: string };
    scheduledTime?: { utc?: string; local?: string };
  };
  number?: string;
  airline?: { name?: string; iata?: string; icao?: string };
};

type FidsResponse = {
  error?: string;
  departures?: FlightEntry[] | { items?: FlightEntry[] };
  departing?: FlightEntry[];
};

function getList(data: FidsResponse | null): FlightEntry[] {
  const rawDeps = data?.departures;
  if (!rawDeps) return data?.departing ?? [];
  if (Array.isArray(rawDeps)) return rawDeps;
  return rawDeps.items ?? data?.departing ?? [];
}

function VatsimBadges({ positions }: { positions?: string[] }) {
  if (!positions?.length) return null;
  return (
    <span className="inline-flex gap-1 flex-wrap">
      {positions.map((p) => (
        <span
          key={p}
          className="text-[10px] px-1 py-px rounded font-mono bg-green-950 text-green-400 border border-green-800/50"
        >
          {p}
        </span>
      ))}
    </span>
  );
}

export default function Page() {
  const { settings, save, activeAircraft } = useUserSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [icao, setIcao] = useState("");
  const [queriedIcao, setQueriedIcao] = useState("");
  const [timeMode, setTimeMode] = useState<TimeMode>("local");
  const [hour12, setHour12] = useState(true);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FidsResponse | null>(null);
  const [airportMap, setAirportMap] = useState<Record<string, AirportRecord>>({});

  const [now, setNow] = useState<Date | null>(null);
  const [selectedFlight, setSelectedFlight] = useState<SelectedFlight | null>(null);
  const [showRouteMap, setShowRouteMap] = useState(false);
  const [highlightedDest, setHighlightedDest] = useState<string | null>(null);
  const [vatsimAtc, setVatsimAtc] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchVatsim() {
      try {
        const res = await fetch("/api/vatsim");
        if (res.ok) setVatsimAtc(await res.json());
      } catch { /* silent */ }
    }
    fetchVatsim();
    const timer = setInterval(fetchVatsim, 120000); // refresh every 2 min
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("lastAirportIcao");
    setIcao(saved ?? settings.defaultAirport);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.defaultAirport]);

  async function load() {
    const v = icao.trim().toUpperCase();
    if (!v) return;

    localStorage.setItem("lastAirportIcao", v);
    setQueriedIcao(v);
    setLoading(true);
    setData(null);
    setAirportMap({});

    try {
      const res = await fetch(
        `/api/fids?icao=${encodeURIComponent(v)}&offsetMinutes=0&durationMinutes=720`
      );
      const json: FidsResponse = await res.json();
      setData(json);

      // Collect all ICAOs (origin + unique destinations)
      const list = getList(json);
      const destIcaos = list
        .map((f) => f.arrival?.airport?.icao)
        .filter((x): x is string => !!x);

      const allIcaos = [...new Set([v, ...destIcaos])];
      const res2 = await fetch(`/api/airports?icaos=${allIcaos.join(",")}`);
      if (res2.ok) {
        const airportData: Record<string, AirportRecord | null> = await res2.json();
        const filtered: Record<string, AirportRecord> = {};
        for (const [k, val] of Object.entries(airportData)) {
          if (val) filtered[k] = val;
        }
        setAirportMap(filtered);
      }
    } catch {
      setData({ error: "Network error – check your connection and try again." });
    } finally {
      setLoading(false);
    }
  }

  const originInfo = airportMap[queriedIcao] ?? null;

  const rows: Row[] = useMemo(() => {
    const list = getList(data);

    return list
      .map((f: FlightEntry) => {
        const dep = normalizeUtc(f.departure?.scheduledTime?.utc);
        const arr = normalizeUtc(f.arrival?.scheduledTime?.utc);
        const dest = f.arrival?.airport?.icao ?? f.arrival?.airport?.iata ?? "—";

        const destCountry =
          f.arrival?.airport?.countryCode?.toUpperCase() ?? airportMap[dest]?.country;

        const destInfo = airportMap[dest];
        const originInfoLocal = airportMap[queriedIcao];

        let estMins: number | null = null;
        if (originInfoLocal && destInfo) {
          const km = haversineKm(originInfoLocal.lat, originInfoLocal.lon, destInfo.lat, destInfo.lon);
          estMins = estFlightMins(km);
        }

        return {
          dest,
          destCity: destInfo?.city,
          destCountry,
          destTz: f.arrival?.airport?.timeZone,
          number: f.number,
          airlineName: f.airline?.name,
          airlineIcao: f.airline?.icao,
          dep,
          arr,
          estMins
        };
      })
      .filter((r) => {
        // Only show international flights
        if (!originInfo) return true;
        if (!r.destCountry) return true;
        return r.destCountry.toUpperCase() !== originInfo.country.toUpperCase();
      });
  }, [data, airportMap, queriedIcao, originInfo]);

  // Derive origin airport timezone from departure local time offset string (always computed for sun/moon)
  const originTz = useMemo(() => {
    const list = getList(data);
    const sample = list[0]?.departure?.scheduledTime?.local;
    if (sample) {
      const match = sample.match(/([+-]\d{2}:\d{2})$/);
      if (match) {
        const offsetStr = match[1]; // e.g. "+02:00"
        const sign = offsetStr[0] === "+" ? -1 : 1;
        const hours = parseInt(offsetStr.slice(1, 3), 10);
        if (hours === 0) return "UTC";
        return `Etc/GMT${sign * hours > 0 ? "+" : ""}${sign * hours}`;
      }
    }
    return undefined;
  }, [data]);

  const displayTz = timeMode === "airport" ? originTz : undefined;

  // Group rows by destination for the route map
  const routeDestinations = useMemo(() => {
    if (!originInfo) return [];
    const map = new Map<string, { lat: number; lon: number; icao: string; city?: string; flights: string[]; firstRowIndex: number }>();
    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      const info = airportMap[r.dest];
      if (!info) continue;
      if (!map.has(r.dest)) {
        map.set(r.dest, { lat: info.lat, lon: info.lon, icao: r.dest, city: r.destCity, flights: [], firstRowIndex: idx });
      }
      if (r.number) map.get(r.dest)!.flights.push(r.number);
    }
    return Array.from(map.values());
  }, [rows, airportMap, originInfo]);

  const orig = queriedIcao || icao.trim().toUpperCase();

  function handleDestClick(icao: string) {
    setHighlightedDest(icao);
    const dest = routeDestinations.find((d) => d.icao === icao);
    if (dest == null) return;
    setTimeout(() => {
      document.getElementById(`flight-row-${dest.firstRowIndex}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Flight Dispatcher</h1>
            <p className="text-slate-400 text-sm">
              Pick an airport → get upcoming international departures → open in SimBrief
              {activeAircraft?.name ? ` with ${activeAircraft.name}` : ""}
            </p>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-slate-400 hover:text-slate-100 transition text-xl mt-1 px-1"
            title="Settings"
          >
            ⚙
          </button>
        </header>

        <section className="rounded-2xl bg-slate-900/60 p-4 shadow space-y-3">
          {/* Row 1: input + search button */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm text-slate-300">Airport (ICAO)</label>
              <input
                className="mt-1 w-full rounded-xl bg-slate-950/70 border border-slate-800 p-3 outline-none"
                placeholder="LLBG"
                value={icao}
                onChange={(e) => setIcao(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
              />
              {originInfo && (
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                  <span>{originInfo.name} — {originInfo.city}, {countryName(originInfo.country)}</span>
                  <VatsimBadges positions={vatsimAtc[queriedIcao]} />
                </div>
              )}
            </div>
            <div className="flex flex-col shrink-0">
              <span className="text-sm invisible select-none" aria-hidden="true">_</span>
              <button
                className="mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-3 font-medium disabled:opacity-60"
                onClick={load}
                disabled={loading}
              >
                {loading ? "Loading..." : "Get departures"}
              </button>
            </div>
          </div>

          {/* Row 2: time mode + 12h/24h toggle (aligned with input) */}
          <div className="flex items-center gap-2">
            {(["local", "airport", "zulu"] as TimeMode[]).map((m) => (
              <button
                key={m}
                className={[
                  "rounded-xl px-3 py-2 text-sm border transition",
                  timeMode === m
                    ? "bg-slate-100 text-slate-900 border-slate-100"
                    : "border-slate-800 hover:bg-slate-900"
                ].join(" ")}
                onClick={() => setTimeMode(m)}
                title={m === "local" ? "Local (device)" : m === "airport" ? "Airport time" : "Zulu (UTC)"}
              >
                {m === "local" ? "Local" : m === "airport" ? "Airport" : "Zulu"}
              </button>
            ))}

            {/* Animated 12h/24h toggle — slides out when Zulu is active */}
            <div
              className="flex items-center gap-2 overflow-hidden transition-all duration-300 ease-in-out"
              style={{
                maxWidth: timeMode === "zulu" ? 0 : 120,
                opacity: timeMode === "zulu" ? 0 : 1,
              }}
            >
              <div className="w-px h-5 bg-slate-700 shrink-0" />
              <button
                className="rounded-xl px-3 py-2 text-sm border border-slate-800 hover:bg-slate-900 font-mono transition whitespace-nowrap"
                onClick={() => setHour12((v) => !v)}
                title="Toggle 12h / 24h format"
                tabIndex={timeMode === "zulu" ? -1 : 0}
              >
                {hour12 ? "12h" : "24h"}
              </button>
            </div>
          </div>

          {/* Row 3: aircraft selector + route map toggle */}
          {settings.aircraft.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Aircraft</span>
              <select
                className="bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-sm outline-none text-slate-100"
                value={settings.activeAircraftIndex}
                onChange={(e) =>
                  save({ ...settings, activeAircraftIndex: Number(e.target.value) })
                }
              >
                {settings.aircraft.map((ac, i) => (
                  <option key={i} value={i}>
                    {ac.name || `Aircraft ${i + 1}`}
                    {ac.baseType ? ` (${ac.baseType})` : ""}
                  </option>
                ))}
              </select>

              {routeDestinations.length > 0 && (
                <button
                  onClick={() => setShowRouteMap((v) => !v)}
                  title="Toggle route map"
                  className={[
                    "px-3 py-2 rounded-xl text-sm border transition",
                    showRouteMap
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-slate-800 text-slate-400 hover:bg-slate-900",
                  ].join(" ")}
                >
                  🗺 Route Map
                </button>
              )}
            </div>
          )}
        </section>

        {showRouteMap && originInfo && routeDestinations.length > 0 && (
          <section>
            <RouteMap
              originLat={originInfo.lat}
              originLon={originInfo.lon}
              originIcao={queriedIcao}
              originCity={originInfo.city}
              destinations={routeDestinations}
              onDestinationClick={handleDestClick}
              vatsimAtc={vatsimAtc}
            />
          </section>
        )}

        <section className="rounded-2xl bg-slate-900/40 p-4 shadow">
          {!data && !loading && (
            <div className="text-slate-400">
              Enter an airport ICAO (e.g. <span className="font-mono">LLBG</span>) and click the button.
            </div>
          )}

          {data?.error && (
            <div className="text-red-300 whitespace-pre-wrap">{String(data.error)}</div>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-300">
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-2 pr-4">FLIGHT</th>
                    <th className="text-left py-2 pr-4">DEST</th>
                    <th className="text-left py-2 pr-4">DEP</th>
                    <th className="text-left py-2 pr-4">ARR</th>
                    <th className="text-left py-2 pr-4">DUR</th>
                    <th className="text-left py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    // Real arrival from withLeg=true; fall back to haversine estimate
                    const arrISO = r.arr ?? (r.dep && r.estMins ? estArrISO(r.dep, r.estMins) : undefined);
                    const isEstimate = !r.arr;

                    const durMins =
                      r.arr && r.dep
                        ? Math.round(
                            (new Date(r.arr).getTime() - new Date(r.dep).getTime()) / 60000
                          )
                        : r.estMins;

                    const arrTz = timeMode === "airport" ? (r.destTz ?? undefined) : undefined;

                    const destInfo = airportMap[r.dest];
                    const canMap = !!(originInfo && destInfo);
                    const isSelected = selectedFlight?.destIcao === r.dest && selectedFlight?.flightNumber === r.number;

                    const isHighlighted = highlightedDest === r.dest;

                    return (
                      <Fragment key={i}>
                        <tr
                          id={`flight-row-${i}`}
                          className={[
                            "border-b transition-colors",
                            isSelected ? "border-indigo-800/60" : "border-slate-800/60",
                            canMap ? "cursor-pointer hover:bg-slate-900/40" : "",
                            isSelected ? "bg-indigo-950/40" : "",
                            isHighlighted && !isSelected ? "bg-amber-950/30 border-amber-800/40" : "",
                          ].join(" ")}
                          onClick={() => {
                            if (!canMap) return;
                            if (isSelected) { setSelectedFlight(null); return; }
                            setSelectedFlight({
                              originLat: originInfo!.lat,
                              originLon: originInfo!.lon,
                              originIcao: queriedIcao,
                              originCity: originInfo!.city,
                              destLat: destInfo.lat,
                              destLon: destInfo.lon,
                              destIcao: r.dest,
                              destCity: r.destCity,
                              flightNumber: r.number,
                            });
                          }}
                        >
                          <td className="py-2 pr-4 whitespace-nowrap">
                            <span className="font-mono">{r.number ?? "—"}</span>
                            {r.airlineName && (
                              <div className="text-xs text-slate-400 mt-0.5">{r.airlineName}</div>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            <span className="font-mono">{r.dest}</span>
                            {(r.destCity || r.destCountry) && (
                              <div className="text-xs text-slate-400 mt-0.5">
                                {[r.destCity, r.destCountry ? countryName(r.destCountry) : undefined]
                                  .filter(Boolean)
                                  .join(", ")}
                              </div>
                            )}
                            {vatsimAtc[r.dest] && (
                              <div className="mt-0.5">
                                <VatsimBadges positions={vatsimAtc[r.dest]} />
                              </div>
                            )}
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {r.dep ? (
                              <div>
                                <span>
                                  <span className="mr-1">{dayNightIcon(r.dep, originTz)}</span>
                                  {fmtTime(r.dep, timeMode, displayTz, hour12)}
                                </span>
                                {now && (() => {
                                  const due = fmtDue(r.dep, now);
                                  return (
                                    <div className={`text-xs mt-0.5 ${due.color}`}>{due.label}</div>
                                  );
                                })()}
                              </div>
                            ) : "—"}
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {arrISO ? (
                              <span>
                                <span className="mr-1">{dayNightIcon(arrISO, r.destTz ?? undefined)}</span>
                                {(isEstimate ? "~" : "") + fmtTime(arrISO, timeMode, arrTz, hour12)}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {durMins
                              ? (isEstimate ? "~" : "") + minsToHMM(durMins)
                              : "—"}
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <a
                              className="text-indigo-300 hover:text-indigo-200"
                              href={simbriefLink(orig, r.dest, r.dep, durMins, r.airlineIcao, r.number, activeAircraft?.baseType, activeAircraft?.airframeId)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              SimBrief →
                            </a>
                          </td>
                        </tr>

                        {isSelected && selectedFlight && (
                          <tr className="border-b border-indigo-800/40 bg-slate-950/60">
                            <td colSpan={6} className="p-0">
                              <FlightMap
                                {...selectedFlight}
                                onClose={() => setSelectedFlight(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-2 text-xs text-slate-500">
                Showing {rows.length} international flights
                {activeAircraft?.name ? ` · ${activeAircraft.name}` : ""}
                {" · "}Click a row to show the flight path
              </div>
            </div>
          )}
        </section>

        <footer className="text-xs text-slate-600 text-center pt-2">
          © {new Date().getFullYear()} Raz Erlich. All rights reserved.
        </footer>
      </div>

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onSave={save}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
