export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  confidence: number;
}

export interface TranslationAvailability {
  sourceLanguage: string;
  targetLanguage: string;
  isAvailable: boolean;
  needsDownload: boolean;
}

export interface TranslationProgressEvent {
  language: string;
  progress: number;
}
