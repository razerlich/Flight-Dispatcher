import { NextResponse } from "next/server";

function cleanIcao(input: string | null): string {
  const v = (input ?? "").trim().toUpperCase();
  // Simple ICAO validation (4 letters). If you want IATA too, add a resolver endpoint later.
  if (!/^[A-Z]{4}$/.test(v)) return "";
  return v;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const icao = cleanIcao(searchParams.get("icao"));
  const offsetMinutes = searchParams.get("offsetMinutes") ?? "0";
  const durationMinutes = searchParams.get("durationMinutes") ?? "720";

  if (!icao) {
    return NextResponse.json(
      { error: "Invalid ICAO. Please enter 4 letters, e.g. LLBG." },
      { status: 400 }
    );
  }

  const baseUrl = `https://aerodatabox.p.rapidapi.com/flights/airports/icao/${icao}`;
  const url = new URL(baseUrl);
  url.searchParams.set("offsetMinutes", offsetMinutes);
  url.searchParams.set("durationMinutes", durationMinutes);
  url.searchParams.set("withLeg", "true"); // include arrival airport + scheduled arrival time

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing RAPIDAPI_KEY. Copy .env.example to .env.local and set RAPIDAPI_KEY." },
      { status: 500 }
    );
  }

  const res = await fetch(url.toString(), {
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com"
    },
    next: { revalidate: 60 } // cache 60s to save free-tier calls
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
