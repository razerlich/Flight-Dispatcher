"use client";

import { useCallback, useEffect, useState } from "react";

export type Aircraft = {
  name: string;
  baseType: string;    // ICAO type code, e.g. "A359" — leave blank to omit from SimBrief
  airframeId: string;  // SimBrief saved-airframe ID — leave blank to omit
};

export type UserSettings = {
  defaultAirport: string;
  activeAircraftIndex: number;
  aircraft: Aircraft[];
};

export const DEFAULT_SETTINGS: UserSettings = {
  defaultAirport: "LLBG",
  activeAircraftIndex: 0,
  aircraft: [
    {
      name: "A359 iniBuilds",
      baseType: "A359",
      airframeId: "1289435_1771861149220",
    },
  ],
};

const KEY = "flightDispatcherSettings";

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch { /* use defaults */ }
  }, []);

  const save = useCallback((next: UserSettings) => {
    setSettings(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const activeAircraft: Aircraft | null =
    settings.aircraft[settings.activeAircraftIndex] ?? null;

  return { settings, save, activeAircraft };
}
