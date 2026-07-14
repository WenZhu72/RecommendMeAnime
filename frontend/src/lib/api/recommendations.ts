import { apiRequest } from "@/lib/api/client";
import type { Anime, AnimeListResponse } from "@/types/anime";
import type { RecommendationPreferences } from "@/types/recommendation";

export async function getRecommendations(preferences: RecommendationPreferences): Promise<Anime[]> {
  const response = await apiRequest<AnimeListResponse>("/api/recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preferences),
    cache: "no-store",
  });
  return response.items;
}
