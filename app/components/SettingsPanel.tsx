"use client";

import type { Aircraft, UserSettings } from "@/app/hooks/useUserSettings";

const AIRCRAFT_TYPES: { group: string; types: { code: string; name: string }[] }[] = [
  {
    group: "Airbus Narrowbody",
    types: [
      { code: "A318", name: "A318" },
      { code: "A319", name: "A319" },
      { code: "A320", name: "A320ceo" },
      { code: "A20N", name: "A320neo" },
      { code: "A321", name: "A321ceo" },
      { code: "A21N", name: "A321neo" },
      { code: "A22N", name: "A321neoXLR" },
    ],
  },
  {
    group: "Airbus Widebody",
    types: [
      { code: "A332", name: "A330-200" },
      { code: "A333", name: "A330-300" },
      { code: "A338", name: "A330-800neo" },
      { code: "A339", name: "A330-900neo" },
      { code: "A342", name: "A340-200" },
      { code: "A343", name: "A340-300" },
      { code: "A345", name: "A340-500" },
      { code: "A346", name: "A340-600" },
      { code: "A359", name: "A350-900" },
      { code: "A35K", name: "A350-1000" },
      { code: "A388", name: "A380-800" },
    ],
  },
  {
    group: "Boeing Narrowbody",
    types: [
      { code: "B733", name: "737-300" },
      { code: "B734", name: "737-400" },
      { code: "B735", name: "737-500" },
      { code: "B736", name: "737-600" },
      { code: "B737", name: "737-700" },
      { code: "B738", name: "737-800" },
      { code: "B739", name: "737-900ER" },
      { code: "B37M", name: "737 MAX 7" },
      { code: "B38M", name: "737 MAX 8" },
      { code: "B39M", name: "737 MAX 9" },
      { code: "B3XM", name: "737 MAX 10" },
      { code: "B752", name: "757-200" },
      { code: "B753", name: "757-300" },
    ],
  },
  {
    group: "Boeing Widebody",
    types: [
      { code: "B762", name: "767-200" },
      { code: "B763", name: "767-300ER" },
      { code: "B764", name: "767-400ER" },
      { code: "B772", name: "777-200" },
      { code: "B77L", name: "777-200LR" },
      { code: "B773", name: "777-300" },
      { code: "B77W", name: "777-300ER" },
      { code: "B778", name: "777X-8" },
      { code: "B779", name: "777X-9" },
      { code: "B788", name: "787-8" },
      { code: "B789", name: "787-9" },
      { code: "B78X", name: "787-10" },
      { code: "B741", name: "747-100" },
      { code: "B742", name: "747-200" },
      { code: "B744", name: "747-400" },
      { code: "B748", name: "747-8" },
    ],
  },
];

type Props = {
  open: boolean;
  settings: UserSettings;
  onSave: (s: UserSettings) => void;
  onClose: () => void;
};

export default function SettingsPanel({ open, settings, onSave, onClose }: Props) {

  function updateAircraft(index: number, field: keyof Aircraft, value: string) {
    const aircraft = settings.aircraft.map((ac, i) =>
      i === index ? { ...ac, [field]: value } : ac
    );
    onSave({ ...settings, aircraft });
  }

  function addAircraft() {
    const aircraft = [...settings.aircraft, { name: "", baseType: "", airframeId: "" }];
    onSave({ ...settings, aircraft, activeAircraftIndex: aircraft.length - 1 });
  }

  function removeAircraft(index: number) {
    const aircraft = settings.aircraft.filter((_, i) => i !== index);
    const activeAircraftIndex = Math.min(
      settings.activeAircraftIndex,
      Math.max(0, aircraft.length - 1)
    );
    onSave({ ...settings, aircraft, activeAircraftIndex });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={[
          "fixed inset-0 bg-black/60 z-40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={[
          "fixed right-0 top-0 bottom-0 w-full max-w-md bg-slate-900 border-l border-slate-800",
          "z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 text-xl leading-none transition"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-8">

          {/* Default Airport */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Default Airport</h3>
            <input
              className="w-full rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-2 outline-none font-mono uppercase text-sm"
              placeholder="LLBG"
              value={settings.defaultAirport}
              maxLength={4}
              onChange={(e) =>
                onSave({ ...settings, defaultAirport: e.target.value.toUpperCase() })
              }
            />
            <p className="text-xs text-slate-500">Pre-fills the ICAO input on first visit.</p>
          </section>

          {/* Aircraft Fleet */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Aircraft Fleet</h3>
              <button
                onClick={addAircraft}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition"
              >
                + Add aircraft
              </button>
            </div>

            {settings.aircraft.length === 0 && (
              <p className="text-sm text-slate-500 rounded-xl border border-slate-800 p-4">
                No aircraft configured. SimBrief links will open without type or airframe data.
              </p>
            )}

            <div className="space-y-3">
              {settings.aircraft.map((ac, i) => {
                const isActive = settings.activeAircraftIndex === i;
                return (
                  <div
                    key={i}
                    className={[
                      "rounded-xl border p-4 space-y-3 transition-colors",
                      isActive
                        ? "border-indigo-600/60 bg-indigo-950/30"
                        : "border-slate-800 bg-slate-950/30",
                    ].join(" ")}
                  >
                    {/* Top row: active radio + name + remove */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onSave({ ...settings, activeAircraftIndex: i })}
                        title="Set as active aircraft"
                        className={[
                          "w-4 h-4 rounded-full border-2 shrink-0 transition-colors",
                          isActive
                            ? "border-indigo-400 bg-indigo-400"
                            : "border-slate-600 hover:border-slate-400",
                        ].join(" ")}
                      />
                      <input
                        className="flex-1 bg-transparent border-b border-slate-700 focus:border-slate-400 outline-none text-sm py-0.5 transition-colors"
                        placeholder="Aircraft name (e.g. A359 iniBuilds)"
                        value={ac.name}
                        onChange={(e) => updateAircraft(i, "name", e.target.value)}
                      />
                      <button
                        onClick={() => removeAircraft(i)}
                        className="text-slate-600 hover:text-red-400 text-sm transition-colors"
                        title="Remove aircraft"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Type + Airframe ID */}
                    <div className="flex gap-4 pl-7">
                      <div className="w-44 space-y-1">
                        <label className="text-[10px] uppercase tracking-widest text-slate-500">
                          Aircraft Type
                        </label>
                        <select
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-sm outline-none font-mono transition-colors focus:border-slate-400"
                          value={ac.baseType}
                          onChange={(e) => updateAircraft(i, "baseType", e.target.value)}
                        >
                          <option value="">— none —</option>
                          {AIRCRAFT_TYPES.map((group) => (
                            <optgroup key={group.group} label={group.group}>
                              {group.types.map((t) => (
                                <option key={t.code} value={t.code}>
                                  {t.code} — {t.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] uppercase tracking-widest text-slate-500">
                          SimBrief Airframe ID
                        </label>
                        <input
                          className="w-full bg-transparent border-b border-slate-700 focus:border-slate-400 outline-none font-mono text-xs py-0.5 transition-colors"
                          placeholder="optional — leave blank to skip"
                          value={ac.airframeId}
                          onChange={(e) => updateAircraft(i, "airframeId", e.target.value)}
                        />
                      </div>
                    </div>

                    {isActive && (
                      <p className="pl-7 text-[10px] text-indigo-400/70">Active — used for SimBrief links</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
