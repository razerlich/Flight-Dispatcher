"use client";

import { useEffect, useMemo, useState } from "react";
import config from "@/config";

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

function fmtTime(dateISO: string, mode: TimeMode, airportTz?: string) {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "—";

  if (mode === "zulu") {
    return (
      new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
        hour12: false
      }).format(d) + "Z"
    );
  }

  if (mode === "airport" && airportTz) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: airportTz,
      hour12: false
    }).format(d);
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
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
  flightNumber?: string
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

  u.searchParams.set("basetype", config.simbrief.baseType);
  u.searchParams.set("type", config.simbrief.airframeId);

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

export default function Page() {
  const [icao, setIcao] = useState("");
  const [queriedIcao, setQueriedIcao] = useState("");
  const [timeMode, setTimeMode] = useState<TimeMode>("local");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FidsResponse | null>(null);
  const [airportMap, setAirportMap] = useState<Record<string, AirportRecord>>({});

  useEffect(() => {
    const saved = localStorage.getItem("lastAirportIcao");
    setIcao(saved ?? config.defaultAirport);
  }, []);

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

  // Derive origin airport timezone from departure local time offset string
  const displayTz = useMemo(() => {
    if (timeMode !== "airport") return undefined;
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
  }, [data, timeMode]);

  const orig = queriedIcao || icao.trim().toUpperCase();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Flight Dispatcher</h1>
          <p className="text-slate-400 text-sm">
            Pick an airport → get upcoming international departures → open in SimBrief with {config.simbrief.baseType}
          </p>
        </header>

        <section className="rounded-2xl bg-slate-900/60 p-4 shadow">
          <div className="flex flex-col md:flex-row gap-3 md:items-end">
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
                <div className="text-xs text-slate-400 mt-1">
                  {originInfo.name} — {originInfo.city}, {countryName(originInfo.country)}
                </div>
              )}
            </div>

            <button
              className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-3 font-medium disabled:opacity-60"
              onClick={load}
              disabled={loading}
            >
              {loading ? "Loading..." : "Get departures"}
            </button>

            <div className="flex gap-2">
              {(["local", "airport", "zulu"] as TimeMode[]).map((m) => (
                <button
                  key={m}
                  className={[
                    "rounded-xl px-3 py-3 border transition",
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
            </div>
          </div>
        </section>

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

                    return (
                      <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-900/30">
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
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {r.dep ? fmtTime(r.dep, timeMode, displayTz) : "—"}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {arrISO
                            ? (isEstimate ? "~" : "") + fmtTime(arrISO, timeMode, arrTz)
                            : "—"}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {durMins
                            ? (isEstimate ? "~" : "") + minsToHMM(durMins)
                            : "—"}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <a
                            className="text-indigo-300 hover:text-indigo-200"
                            href={simbriefLink(orig, r.dest, r.dep, durMins, r.airlineIcao, r.number)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            SimBrief →
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-2 text-xs text-slate-500">
                Showing {rows.length} international flights · {config.simbrief.baseType} iniBuilds
              </div>
            </div>
          )}
        </section>

        <footer className="text-xs text-slate-600">
          Free-tier friendly: server caches 1 min · airport data from OurAirports
        </footer>
      </div>
    </main>
  );
}
