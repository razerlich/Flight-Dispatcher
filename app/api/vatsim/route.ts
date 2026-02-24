import { NextResponse } from "next/server";

const POSITIONS = ["DEL", "GND", "TWR", "APP", "DEP", "CTR", "FSS"];

export async function GET() {
  const res = await fetch("https://data.vatsim.net/v3/vatsim-data.json", {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch VATSIM data" }, { status: 502 });
  }

  const data = await res.json();
  const controllers: Array<{ callsign: string }> = data.controllers ?? [];

  const atc: Record<string, string[]> = {};

  for (const ctrl of controllers) {
    const parts = ctrl.callsign.split("_");
    if (parts.length < 2) continue;

    const icao = parts[0];
    if (!/^[A-Z]{4}$/.test(icao)) continue;

    const suffix = parts[parts.length - 1];
    if (!POSITIONS.includes(suffix)) continue;

    (atc[icao] ??= []).push(suffix);
  }

  return NextResponse.json(atc);
}
