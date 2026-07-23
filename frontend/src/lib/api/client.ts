import { API_BASE_URL } from "@/lib/api/config";

type ApiErrorPayload = { detail?: unknown };

type ApiRequestOptions = RequestInit & {
  revalidate?: number;
  retry?: boolean;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const CATALOGUE_POLICY_VERSION = "strict-non-adult-v1";

export class ApiError extends Error {
  status: number;
  retryable: boolean;

  constructor(message: string, status: number, retryable = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryable = retryable;
  }
}

function errorDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("detail" in payload)) return null;
  const detail = (payload as ApiErrorPayload).detail;
  return typeof detail === "string" ? detail : null;
}

function apiUrl(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ApiError("Invalid API request path.", 500);
  }
  const separator = path.includes("?") ? "&" : "?";
  return `${API_BASE_URL}${path}${separator}catalogue_policy=${CATALOGUE_POLICY_VERSION}`;
}

async function requestOnce<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const { revalidate, retry: _, timeoutMs = DEFAULT_TIMEOUT_MS, headers, signal, ...requestOptions } = options;
  void _;
  const controller = new AbortController();
  const abortForCaller = () => controller.abort();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abortForCaller, { once: true });

  try {
    let response: Response;
    try {
      response = await fetch(apiUrl(path), {
        ...requestOptions,
        headers: { Accept: "application/json", ...headers },
        signal: controller.signal,
        next: revalidate === undefined ? undefined : { revalidate },
      });
    } catch {
      if (signal?.aborted) {
        throw new ApiError("The request was cancelled.", 499);
      }
      if (controller.signal.aborted) {
        throw new ApiError(
          "The anime service is taking longer than expected. It may be waking up; please retry.",
          504,
          true,
        );
      }
      throw new ApiError("The anime service is unavailable. Please try again shortly.", 503, true);
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      if (signal?.aborted) {
        throw new ApiError("The request was cancelled.", 499);
      }
      if (controller.signal.aborted) {
        throw new ApiError("The anime service timed out. Please retry.", 504, true);
      }
      if (!response.ok) {
        throw new ApiError("The anime service returned an invalid response.", response.status);
      }
    }

    if (!response.ok) {
      const retryable = response.status === 503 || response.status === 504;
      throw new ApiError(
        errorDetail(payload) ?? "The anime service could not complete this request.",
        response.status,
        retryable,
      );
    }

    if (payload === null) {
      throw new ApiError("The anime service returned an invalid response.", 502);
    }

    return payload as T;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortForCaller);
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const canRetry = method === "GET" && options.retry !== false;

  try {
    return await requestOnce<T>(path, options);
  } catch (error) {
    if (!(error instanceof ApiError) || !canRetry || !error.retryable) throw error;
    if (process.env.NODE_ENV === "development") {
      console.error("Retrying a temporary API failure", { status: error.status });
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
    return requestOnce<T>(path, { ...options, retry: false });
  }
}

export function queryString(
  parameters: Record<string, string | number | readonly string[] | undefined>,
): string {
  const query = new URLSearchParams();
  Object.entries(parameters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) query.append(key, item);
      });
    } else if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}
