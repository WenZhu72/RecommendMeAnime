import { Anime } from "@/types/anime";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function searchAnime(query: string): Promise<Anime[]> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  const response = await fetch(
    `${API_BASE_URL}/search?query=${encodeURIComponent(query)}`
  );

  if (!response.ok) {
    throw new Error("Failed to search anime");
  }

  return response.json();
}