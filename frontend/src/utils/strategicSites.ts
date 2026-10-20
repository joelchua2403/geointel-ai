
import { useCallback, useEffect, useState } from "react";

export type StrategicSite = {
  id: string;
  name: string;
  category: string;
  description: string;
  lat: number;
  lng: number;
  enabled: boolean;
};

const API_URL = "http://localhost:8000/api/strategic-sites";

const STORAGE_KEY = "geointel-strategic-sites-v1";

function isStrategicSite(value: unknown): value is StrategicSite {
  if (!value || typeof value !== "object") return false;

  const site = value as Record<string, unknown>;

  return (
    typeof site.id === "string" &&
    typeof site.name === "string" &&
    typeof site.category === "string" &&
    typeof site.description === "string" &&
    typeof site.lat === "number" &&
    typeof site.lng === "number" &&
    typeof site.enabled === "boolean"
  );
}

function readLocalSites(): StrategicSite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.filter(isStrategicSite)
      : [];
  } catch {
    return [];
  }
}

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `API error ${response.status}: ${message}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function useStrategicSites() {
  const [sites, setSitesState] = useState<StrategicSite[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [sitesError, setSitesError] = useState<string | null>(null);

  const refreshSites = useCallback(async () => {
    setLoadingSites(true);
    setSitesError(null);

    try {
      const remoteSites = await request<StrategicSite[]>(
        API_URL
      );

      // Import existing browser sites once.
      const localSites = readLocalSites();

      const existingIds = new Set(
        remoteSites.map((site) => site.id)
      );

      const imported = [...remoteSites];

      for (const site of localSites) {
        if (existingIds.has(site.id)) continue;

        try {
          const saved = await request<StrategicSite>(
            API_URL,
            {
              method: "POST",
              body: JSON.stringify(site),
            }
          );

          imported.push(saved);
          existingIds.add(saved.id);
        } catch (error) {
          console.warn(
            "Could not migrate strategic site:",
            site.name,
            error
          );
        }
      }

      setSitesState(imported);

      // Remove the old local storage only when all
      // locally stored site IDs exist in the database.
      if (
        localSites.every((site) =>
          existingIds.has(site.id)
        )
      ) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      setSitesError(
        error instanceof Error
          ? error.message
          : "Failed to load strategic sites"
      );
    } finally {
      setLoadingSites(false);
    }
  }, []);

  useEffect(() => {
    void refreshSites();
  }, [refreshSites]);

  const setSites = useCallback(
    async (nextSites: StrategicSite[]) => {
      setSitesError(null);

      try {
        const currentSites = sites;

        const currentById = new Map(
          currentSites.map((site) => [site.id, site])
        );

        const nextById = new Map(
          nextSites.map((site) => [site.id, site])
        );

        // Delete removed sites.
        for (const site of currentSites) {
          if (!nextById.has(site.id)) {
            await request<void>(
              `${API_URL}/${encodeURIComponent(site.id)}`,
              { method: "DELETE" }
            );
          }
        }

        // Create new sites and update modified ones.
        for (const site of nextSites) {
          const previous = currentById.get(site.id);

          if (!previous) {
            await request<StrategicSite>(
              API_URL,
              {
                method: "POST",
                body: JSON.stringify(site),
              }
            );
          } else if (
            JSON.stringify(previous) !==
            JSON.stringify(site)
          ) {
            await request<StrategicSite>(
              `${API_URL}/${encodeURIComponent(site.id)}`,
              {
                method: "PUT",
                body: JSON.stringify(site),
              }
            );
          }
        }

        await refreshSites();
      } catch (error) {
        setSitesError(
          error instanceof Error
            ? error.message
            : "Failed to save strategic sites"
        );

        await refreshSites();
      }
    },
    [sites, refreshSites]
  );

  return {
    sites,
    setSites,
    loadingSites,
    sitesError,
    refreshSites,
  };
}
