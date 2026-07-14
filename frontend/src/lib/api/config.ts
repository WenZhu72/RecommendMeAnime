const LOCAL_API_URL = "http://localhost:8000";

function configuredApiBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const rawUrl = configuredUrl || (process.env.NODE_ENV === "development" ? LOCAL_API_URL : undefined);

  if (!rawUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is required outside development. Set it to the deployed FastAPI URL.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be an absolute HTTP(S) URL.");
  }

  if (!/^https?:$/.test(parsedUrl.protocol)) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must use http or https.");
  }
  if (parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must not contain credentials, a query string, or a fragment.");
  }

  return rawUrl.replace(/\/+$/, "");
}

export const API_BASE_URL = configuredApiBaseUrl();
