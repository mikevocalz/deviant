import { requireOptionalNativeModule } from 'expo-modules-core';
import { TranslationResult } from './Translation.types';

interface TranslationModuleType {
  translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<TranslationResult>;
  isTranslationAvailable(
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<boolean>;
  downloadLanguagePack(language: string): Promise<void>;
  getAvailableLanguages(): Promise<string[]>;
}

// requireOptionalNativeModule returns null instead of throwing when the native
// module is not registered — prevents JS bundle load failure + ErrorRecovery.crash()
const TranslationModule = requireOptionalNativeModule<TranslationModuleType>('Translation');
export default TranslationModule;
