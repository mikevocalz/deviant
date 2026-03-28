type NitroFetchModule = {
  fetch: typeof fetch;
  prefetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<void>;
};

let nitroFetchModule: NitroFetchModule | null = null;

try {
  nitroFetchModule = require("react-native-nitro-fetch");
} catch (error) {
  console.warn("[HTTP] react-native-nitro-fetch unavailable, using fetch", error);
}

const baseFetch: typeof fetch =
  nitroFetchModule?.fetch ?? globalThis.fetch.bind(globalThis);

export interface AppFetchInit extends RequestInit {
  timeoutMs?: number;
  traceName?: string;
}

export class AppHttpError extends Error {
  status: number;
  url: string;
  body: string;

  constructor(
    message: string,
    options: { status: number; url: string; body: string },
  ) {
    super(message);
    this.name = "AppHttpError";
    this.status = options.status;
    this.url = options.url;
    this.body = options.body;
  }
}

function stringifyInput(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function isNitroFetchAvailable(): boolean {
  return nitroFetchModule != null;
}

export async function appFetch(
  input: RequestInfo | URL,
  init: AppFetchInit = {},
): Promise<Response> {
  const { timeoutMs = 10_000, traceName, signal, ...requestInit } = init;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const parentAbort = () => controller.abort();
  signal?.addEventListener("abort", parentAbort, { once: true });

  try {
    return await baseFetch(input, {
      ...requestInit,
      signal: controller.signal,
    });
  } catch (error) {
    const target = traceName || stringifyInput(input);
    if (controller.signal.aborted) {
      throw new Error(`[HTTP] ${target} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", parentAbort);
  }
}

export async function appFetchJson<T>(
  input: RequestInfo | URL,
  init: AppFetchInit = {},
): Promise<T> {
  const response = await appFetch(input, init);
  const url = stringifyInput(input);
  const bodyText = await response.text();

  if (!response.ok) {
    throw new AppHttpError(`[HTTP] ${url} failed with ${response.status}`, {
      status: response.status,
      url,
      body: bodyText,
    });
  }

  if (!bodyText) {
    return null as T;
  }

  return JSON.parse(bodyText) as T;
}

export async function appPrefetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<void> {
  if (!nitroFetchModule?.prefetch) return;
  await nitroFetchModule.prefetch(input, init);
}
