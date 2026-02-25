import { NextResponse } from "next/server";
import airportsDb from "@/app/data/airports.json";

type AirportRecord = { lat: number; lon: number; city: string; country: string; name: string };
type Result = { icao: string; name: string; city: string; country: string };

const db = airportsDb as Record<string, AirportRecord>;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) return NextResponse.json([]);

  const qUpper = q.toUpperCase();
  const qLower = q.toLowerCase();

  const icaoHits: Result[] = [];
  const nameHits: Result[] = [];

  for (const [icao, rec] of Object.entries(db)) {
    if (!rec) continue;
    const entry: Result = { icao, name: rec.name, city: rec.city, country: rec.country };

    if (icao.startsWith(qUpper)) {
      icaoHits.push(entry);
    } else if (
      rec.name.toLowerCase().includes(qLower) ||
      rec.city.toLowerCase().includes(qLower)
    ) {
      nameHits.push(entry);
    }
  }

  // Exact ICAO match floats to top
  icaoHits.sort((a, b) => {
    if (a.icao === qUpper) return -1;
    if (b.icao === qUpper) return 1;
    return a.icao.localeCompare(b.icao);
  });

  return NextResponse.json([...icaoHits, ...nameHits].slice(0, 8));
}
