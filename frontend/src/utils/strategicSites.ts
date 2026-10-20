
import { useEffect, useState } from "react";

export type StrategicSite = {
  id: string;
  name: string;
  category: string;
  description: string;
  lat: number;
  lng: number;
  enabled: boolean;
};

const STORAGE_KEY = "geointel-strategic-sites-v1";

function validSite(value: unknown): value is StrategicSite {
  if (!value || typeof value !== "object") return false;

  const s = value as Partial<StrategicSite>;

  return (
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    typeof s.category === "string" &&
    typeof s.description === "string" &&
    typeof s.enabled === "boolean" &&
    typeof s.lat === "number" &&
    Number.isFinite(s.lat) &&
    s.lat >= -90 &&
    s.lat <= 90 &&
    typeof s.lng === "number" &&
    Number.isFinite(s.lng) &&
    s.lng >= -180 &&
    s.lng <= 180
  );
}

function loadSites(): StrategicSite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.filter(validSite)
      : [];
  } catch {
    return [];
  }
}

export function useStrategicSites() {
  const [sites, setSites] = useState<StrategicSite[]>(loadSites);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sites));
    } catch (error) {
      console.error("Unable to save strategic sites", error);
    }
  }, [sites]);

  return { sites, setSites };
}
