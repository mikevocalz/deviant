const getPayloadUrl = (): string => {
  const url = process.env.PAYLOAD_CMS_URL;
  if (!url) {
    throw new Error("PAYLOAD_CMS_URL environment variable is not set");
  }
  return url;
};

interface PayloadFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: string;
  headers?: Record<string, string>;
}

export async function payloadFetch<T = unknown>(
  endpoint: string,
  options: PayloadFetchOptions = {}
): Promise<T> {
  const baseUrl = getPayloadUrl();
  const url = `${baseUrl}/api${endpoint}`;
  
  console.log(`[PayloadCMS] ${options.method || "GET"} ${url}`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[PayloadCMS] Error ${response.status}:`, errorData);
      throw new Error(
        (errorData as { message?: string }).message || 
        `Payload CMS request failed with status ${response.status}`
      );
    }

    const data = await response.json();
    console.log(`[PayloadCMS] Success:`, JSON.stringify(data).slice(0, 200));
    return data as T;
  } catch (error) {
    console.error(`[PayloadCMS] Request failed:`, error);
    throw error;
  }
}
