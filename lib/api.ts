import { getApiBaseUrl } from "@/lib/api-config";

// CRITICAL: Use canonical API URL resolver - NEVER empty string fallback
export const API_BASE = getApiBaseUrl();

export async function uploadFaceForVerification(params: {
  token?: string;
  faceImageUri: string;
}) {
  // API_BASE is now guaranteed to be a valid HTTPS URL

  const form = new FormData();
  form.append("face", {
    uri: params.faceImageUri,
    name: "face.jpg",
    type: "image/jpeg",
  } as any);

  const res = await fetch(`${API_BASE}/verification/face`, {
    method: "POST",
    headers: {
      ...(params.token ? { Authorization: `Bearer ${params.token}` } : {}),
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Face verification upload failed");
  }

  return res.json() as Promise<{ ok: boolean; verificationId: string }>;
}
