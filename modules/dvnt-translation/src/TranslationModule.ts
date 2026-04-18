import { requireOptionalNativeModule } from 'expo-modules-core';
import { TranslationResult } from './Translation.types';

interface DVNTTranslationModuleType {
  translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<TranslationResult>;
  isTranslationAvailable(
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<boolean>;
  detectLanguage(text: string): Promise<string>;
  downloadLanguagePack(language: string): Promise<void>;
  getAvailableLanguages(): Promise<string[]>;
}

// requireOptionalNativeModule returns null instead of throwing when the native
// module is not registered — prevents JS bundle load failure + ErrorRecovery crash.
const DVNTTranslationModule = requireOptionalNativeModule<DVNTTranslationModuleType>('DVNTTranslation');
export default DVNTTranslationModule;
