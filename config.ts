// ─── App configuration ────────────────────────────────────────────────────────
// Edit this file to update your personal defaults.
// ──────────────────────────────────────────────────────────────────────────────

const config = {

  // SimBrief ──────────────────────────────────────────────────────────────────
  simbrief: {
    // Your saved airframe Internal ID.
    // Find it in SimBrief → Aircraft → open your airframe for editing.
    // Use this instead of a plain type code to pre-select the full profile.
    airframeId: "1289435_1771861149220",

    // ICAO aircraft type code — shown as the base type alongside the airframe.
    baseType: "A359",
  },

  // Default departure airport ─────────────────────────────────────────────────
  // Pre-fills the ICAO input on first load (can still be overridden).
  // Set to "" to leave the field empty.
  defaultAirport: "LLBG",

} as const;

export default config;
