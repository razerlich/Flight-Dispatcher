# Flight Dispatcher (Next.js + Tailwind)

A small web app: pick a departure airport (ICAO) → get upcoming international departures with estimated flight time → open directly in SimBrief.

## Requirements
- Node.js 18+ (20+ recommended)
- RapidAPI key for AeroDataBox (Free tier)

## Setup

```bash
npm install
```

Copy `.env.example` to `.env.local` and add your key:

```
RAPIDAPI_KEY=xxxxxxxxxxxxxxxx
```

## Running

```bash
npm run dev
```

Then open http://localhost:3000, enter an ICAO code (e.g. `LLBG`) and click the button.

## Configuration

Edit `config.ts` to set your personal defaults:

```ts
simbrief: {
  airframeId: "...",   // Internal ID of your saved SimBrief airframe
  baseType:   "A359",  // ICAO aircraft type code
},
defaultAirport: "LLBG", // Pre-fills the ICAO input on first load
```

## Notes
- Only ICAO codes (4 letters) are supported as input. IATA support (3 letters) can be added with a small resolver endpoint.
- ARR and DUR are estimates based on great-circle distance at ~480 kt average speed.
- Airport coordinate data is bundled from OurAirports (public domain).
- The server caches flight data for 60 seconds to stay within the free API tier.
