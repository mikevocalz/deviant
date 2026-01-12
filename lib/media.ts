import { Paths, File, Directory } from 'expo-file-system'

const VERIFICATION_DIR = new Directory(Paths.document, 'verification')

export async function ensureVerificationDir() {
  if (!VERIFICATION_DIR.exists) {
    await VERIFICATION_DIR.create()
  }
}

export async function persistVerificationPhoto(tempPathOrUri: string, name: string) {
  await ensureVerificationDir()
  const sourceUri = tempPathOrUri.startsWith('file://') ? tempPathOrUri : `file://${tempPathOrUri}`
  const sourceFile = new File(sourceUri)
  const destFile = new File(VERIFICATION_DIR, name)
  await sourceFile.move(destFile)
  return destFile.uri
}
