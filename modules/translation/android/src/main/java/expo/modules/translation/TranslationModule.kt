package expo.modules.translation

import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.TranslatorOptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class TranslationModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Translation")

    AsyncFunction("translateText") { text: String, sourceLanguage: String, targetLanguage: String ->
      val sourceLang = mapLanguageCode(sourceLanguage)
      val targetLang = mapLanguageCode(targetLanguage)

      val options = TranslatorOptions.Builder()
        .setSourceLanguage(sourceLang)
        .setTargetLanguage(targetLang)
        .build()

      val translator = Translation.getClient(options)
      try {
        // Download model on WiFi only if not already present.
        val conditions = DownloadConditions.Builder().requireWifi().build()
        translator.downloadModelIfNeeded(conditions).await()
        val result = translator.translate(text).await()

        mapOf(
          "translatedText" to result,
          "sourceLanguage" to sourceLanguage,
          "confidence" to 1.0,
        )
      } finally {
        translator.close()
      }
    }

    AsyncFunction("isTranslationAvailable") { sourceLanguage: String, targetLanguage: String ->
      val sourceLang = mapLanguageCode(sourceLanguage)
      val targetLang = mapLanguageCode(targetLanguage)
      val allLanguages = TranslateLanguage.getAllLanguages()
      allLanguages.contains(sourceLang) && allLanguages.contains(targetLang)
    }

    AsyncFunction("downloadLanguagePack") { language: String ->
      val langCode = mapLanguageCode(language)
      // Download just the model for this language using ModelManager.
      // ML Kit will use it for any pair involving this language.
      val model = TranslateRemoteModel.Builder(langCode).build()
      val conditions = DownloadConditions.Builder().build()
      RemoteModelManager.getInstance().download(model, conditions).await()
    }

    AsyncFunction("getAvailableLanguages") {
      // Map ML Kit internal codes to BCP-47 codes.
      TranslateLanguage.getAllLanguages().map { code ->
        when (code) {
          TranslateLanguage.CHINESE -> "zh"
          TranslateLanguage.ENGLISH -> "en"
          TranslateLanguage.SPANISH -> "es"
          TranslateLanguage.FRENCH -> "fr"
          TranslateLanguage.GERMAN -> "de"
          TranslateLanguage.ITALIAN -> "it"
          TranslateLanguage.PORTUGUESE -> "pt"
          TranslateLanguage.JAPANESE -> "ja"
          TranslateLanguage.KOREAN -> "ko"
          TranslateLanguage.ARABIC -> "ar"
          TranslateLanguage.RUSSIAN -> "ru"
          TranslateLanguage.THAI -> "th"
          TranslateLanguage.VIETNAMESE -> "vi"
          TranslateLanguage.POLISH -> "pl"
          TranslateLanguage.DUTCH -> "nl"
          TranslateLanguage.TURKISH -> "tr"
          TranslateLanguage.INDONESIAN -> "id"
          else -> code
        }
      }.distinct()
    }
  }

  /** Maps BCP-47 / user-facing codes to ML Kit's internal language codes. */
  private fun mapLanguageCode(code: String): String = when (code) {
    "auto" -> TranslateLanguage.ENGLISH
    "zh", "zh-Hans", "zh-Hant" -> TranslateLanguage.CHINESE
    else -> code
  }
}

// MARK: - Task<T>.await() — bridge GMS Task to Kotlin coroutines

private suspend fun <T> com.google.android.gms.tasks.Task<T>.await(): T =
  suspendCancellableCoroutine { cont ->
    addOnSuccessListener { result ->
      @Suppress("UNCHECKED_CAST")
      cont.resume(result as T)
    }
    addOnFailureListener { ex ->
      cont.resumeWithException(ex)
    }
    addOnCanceledListener {
      cont.cancel()
    }
  }
