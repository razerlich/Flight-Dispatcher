import { NextResponse } from "next/server";
import airportsDb from "@/app/data/airports.json";

type AirportRecord = {
  lat: number;
  lon: number;
  city: string;
  country: string;
  name: string;
};

const db = airportsDb as Record<string, AirportRecord>;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("icaos") ?? "";
  const icaos = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{4}$/.test(s));

  if (icaos.length === 0) {
    return NextResponse.json({ error: "No valid ICAOs" }, { status: 400 });
  }

  const result: Record<string, AirportRecord | null> = {};
  for (const icao of icaos) {
    result[icao] = db[icao] ?? null;
  }
  return NextResponse.json(result);
}
