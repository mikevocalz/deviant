// JS stub — native bridge reserved for future on-device translation.
// The translation-store uses a try/catch around this import so failures
// degrade gracefully to returning the original text.

import { TranslationResult } from './Translation.types';

const TranslationModule = {
  async translateText(
    _text: string,
    _sourceLanguage: string,
    _targetLanguage: string,
  ): Promise<TranslationResult> {
    throw new Error('Native translation module not available');
  },
  async isTranslationAvailable(
    _sourceLanguage: string,
    _targetLanguage: string,
  ): Promise<boolean> {
    return false;
  },
  async downloadLanguagePack(_language: string): Promise<void> {
    // no-op
  },
  async getAvailableLanguages(): Promise<string[]> {
    return [];
  },
};

export default TranslationModule;
