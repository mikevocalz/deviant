// Keep your zip's parsing logic here. This is a lightweight placeholder that tries to extract a few fields.
export function parseId(blocks: string[]) {
  const text = blocks.join('\n')

  const dobMatch = text.match(/\b(\d{2}\/\d{2}\/\d{4})\b/)
  const idMatch = text.match(/\bID\s*#?\s*([A-Z0-9-]{5,})\b/i)

  // naive: pick first two uppercase-ish words as name
  const words = text.replace(/[^A-Za-z\s]/g, ' ').split(/\s+/).filter(Boolean)
  const firstName = words[0]
  const lastName = words[1]

  return {
    firstName,
    lastName,
    dob: dobMatch?.[1],
    documentNumber: idMatch?.[1]
  }
}
