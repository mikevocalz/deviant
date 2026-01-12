export const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? ''

export async function uploadFaceForVerification(params: { token?: string; faceImageUri: string }) {
  if (!API_BASE) {
    // No backend configured; treat as success for local dev.
    return { ok: true, verificationId: 'local-dev' as const }
  }

  const form = new FormData()
  form.append('face', {
    uri: params.faceImageUri,
    name: 'face.jpg',
    type: 'image/jpeg'
  } as any)

  const res = await fetch(`${API_BASE}/verification/face`, {
    method: 'POST',
    headers: {
      ...(params.token ? { Authorization: `Bearer ${params.token}` } : {})
    },
    body: form
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || 'Face verification upload failed')
  }

  return res.json() as Promise<{ ok: boolean; verificationId: string }>
}
