import type { RecommendationPreferences } from "@/types/recommendation";

const STORAGE_KEY = "recommend-me-anime-preferences";

export function saveRecommendationPreferences(preferences: RecommendationPreferences): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }
}

export function getSavedRecommendationPreferences(): RecommendationPreferences | null {
  if (typeof window === "undefined") return null;

  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as RecommendationPreferences;
  } catch {
    return null;
  }
}
