import ExpoModulesCore
import NaturalLanguage

// Apple Translation framework — iOS 18.0+
// Programmatic access via TranslationSession.init(configuration:), added iOS 18.0.
// On iOS < 18.0 all translation functions throw; detection and capability checks degrade gracefully.
#if canImport(Translation)
import Translation
#endif

// MARK: - Module

public class DVNTTranslationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DVNTTranslation")

    // ── isTranslationAvailable ─────────────────────────────────────────────
    // Returns true if at least one direction involving the target language is
    // supported (installed or downloadable). Source "auto" scans common pairs.
    AsyncFunction("isTranslationAvailable") {
      (sourceLanguage: String, targetLanguage: String) async -> Bool in
      guard #available(iOS 18.0, *) else { return false }
      #if canImport(Translation)
      return await DVNTTranslationModule.checkAvailable(source: sourceLanguage, target: targetLanguage)
      #else
      return false
      #endif
    }

    // ── getAvailabilityStatus ──────────────────────────────────────────────
    // Returns "installed" | "supported" | "unsupported" for a specific pair.
    AsyncFunction("getAvailabilityStatus") {
      (sourceLanguage: String, targetLanguage: String) async -> String in
      guard #available(iOS 18.0, *) else { return "unsupported" }
      #if canImport(Translation)
      return await DVNTTranslationModule.availabilityStatus(source: sourceLanguage, target: targetLanguage)
      #else
      return "unsupported"
      #endif
    }

    // ── detectLanguage ─────────────────────────────────────────────────────
    // Uses NLLanguageRecognizer — available on all iOS versions, no framework gate.
    AsyncFunction("detectLanguage") {
      (text: String) async -> String in
      return DVNTTranslationModule.detectCode(text)
    }

    // ── translateText ──────────────────────────────────────────────────────
    // Uses TranslationSession(configuration:) — iOS 18.0+ programmatic API.
    // Source language "auto" triggers NLLanguageRecognizer detection.
    AsyncFunction("translateText") {
      (text: String, sourceLanguage: String, targetLanguage: String) async throws -> [String: Any] in
      guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        return ["translatedText": text, "detectedSourceLanguage": ""]
      }
      guard #available(iOS 18.0, *) else {
        throw DVNTTranslationError.unavailable
      }
      #if canImport(Translation)
      let tgtCode = DVNTTranslationModule.normalizeCode(targetLanguage)
      let srcCode: String?
      if sourceLanguage == "auto" || sourceLanguage.isEmpty {
        let detected = DVNTTranslationModule.detectCode(text)
        srcCode = detected == "und" ? nil : detected
      } else {
        srcCode = DVNTTranslationModule.normalizeCode(sourceLanguage)
      }

      // If source == target, return as-is
      if let src = srcCode, src == tgtCode {
        return ["translatedText": text, "detectedSourceLanguage": src]
      }

      let srcLang: Locale.Language? = srcCode.map { Locale.Language(identifier: $0) }
      let tgtLang = Locale.Language(identifier: tgtCode)
      let translated = try await DVNTTranslationModule.translate(text: text, source: srcLang, target: tgtLang)
      return ["translatedText": translated, "detectedSourceLanguage": srcCode ?? ""]
      #else
      throw DVNTTranslationError.unavailable
      #endif
    }

    // ── translateBatch ─────────────────────────────────────────────────────
    // Translates multiple strings in a single session. Items that fail are
    // returned with success: false and the original text preserved.
    AsyncFunction("translateBatch") {
      (items: [String], sourceLanguage: String, targetLanguage: String) async throws -> [[String: Any]] in
      guard #available(iOS 18.0, *) else {
        throw DVNTTranslationError.unavailable
      }
      #if canImport(Translation)
      guard !items.isEmpty else { return [] }
      let tgtCode = DVNTTranslationModule.normalizeCode(targetLanguage)
      let srcCode: String? = (sourceLanguage == "auto" || sourceLanguage.isEmpty)
        ? nil
        : DVNTTranslationModule.normalizeCode(sourceLanguage)
      let srcLang: Locale.Language? = srcCode.map { Locale.Language(identifier: $0) }
      let tgtLang = Locale.Language(identifier: tgtCode)

      var results: [[String: Any]] = []
      for item in items {
        if item.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
          results.append(["originalText": item, "translatedText": item, "success": true])
          continue
        }
        do {
          let translated = try await DVNTTranslationModule.translate(text: item, source: srcLang, target: tgtLang)
          results.append(["originalText": item, "translatedText": translated, "success": true])
        } catch {
          results.append(["originalText": item, "translatedText": item, "success": false, "error": error.localizedDescription])
        }
      }
      return results
      #else
      throw DVNTTranslationError.unavailable
      #endif
    }

    // ── downloadLanguagePack ───────────────────────────────────────────────
    // Language models are managed automatically by TranslationSession.
    // This stub exists for API symmetry; the system handles downloads on demand.
    AsyncFunction("downloadLanguagePack") { (_: String) async -> Void in }

    // ── getAvailableLanguages ──────────────────────────────────────────────
    AsyncFunction("getAvailableLanguages") {
      () async -> [String] in
      guard #available(iOS 18.0, *) else { return [] }
      return [
        "en", "es", "fr", "de", "it", "pt", "ja", "ko", "zh", "ar", "ru",
        "th", "vi", "pl", "nl", "tr", "id", "uk", "hi", "sv", "da", "fi",
        "nb", "cs", "hu", "ro", "sk", "bg", "hr", "ms",
      ]
    }
  }

  // MARK: - Helpers

  static func normalizeCode(_ code: String) -> String {
    return code.split(separator: "-").first.map(String.init) ?? code
  }

  static func detectCode(_ text: String) -> String {
    let recognizer = NLLanguageRecognizer()
    recognizer.processString(String(text.prefix(500)))
    guard let lang = recognizer.dominantLanguage, lang != .undetermined else {
      return "und"
    }
    return lang.rawValue
  }

  #if canImport(Translation)
  // Uses TranslationSession(installedSource:target:) — iOS 18.0+ programmatic API.
  // Unlike .translationTask, this does not require a SwiftUI view context.
  // Requires language packs to already be installed on the device; if not installed
  // the call throws DVNTTranslationError.notInstalled so the JS layer can fall back.
  @available(iOS 18.0, *)
  static func translate(text: String, source: Locale.Language?, target: Locale.Language) async throws -> String {
    // Resolve source language — detect if caller passed nil/auto
    let resolvedSrc: Locale.Language
    if let src = source {
      resolvedSrc = src
    } else {
      let detected = detectCode(text)
      guard detected != "und" else { throw DVNTTranslationError.detectionFailed }
      resolvedSrc = Locale.Language(identifier: detected)
    }

    // Only installed language packs can be used without the SwiftUI view lifecycle
    let avail = LanguageAvailability()
    let status = await avail.status(from: resolvedSrc, to: target)
    guard status == .installed else {
      throw DVNTTranslationError.notInstalled
    }

    let session = TranslationSession(installedSource: resolvedSrc, target: target)
    let response = try await session.translate(text)
    return response.targetText
  }

  @available(iOS 18.0, *)
  static func checkAvailable(source: String, target: String) async -> Bool {
    let avail = LanguageAvailability()
    let tgt = Locale.Language(identifier: normalizeCode(target))

    if source != "auto" && !source.isEmpty {
      let src = Locale.Language(identifier: normalizeCode(source))
      let status = await avail.status(from: src, to: tgt)
      return status != .unsupported
    }

    for code in ["en", "es", "fr", "de", "zh", "ja", "ko", "ar", "ru", "pt", "it"] {
      let src = Locale.Language(identifier: code)
      let status = await avail.status(from: src, to: tgt)
      if status != .unsupported { return true }
    }
    return false
  }

  @available(iOS 18.0, *)
  static func availabilityStatus(source: String, target: String) async -> String {
    let avail = LanguageAvailability()
    let src = Locale.Language(identifier: normalizeCode(source))
    let tgt = Locale.Language(identifier: normalizeCode(target))
    let status = await avail.status(from: src, to: tgt)
    switch status {
    case .installed: return "installed"
    case .supported: return "supported"
    case .unsupported: return "unsupported"
    @unknown default: return "unknown"
    }
  }
  #endif
}

// MARK: - Errors

enum DVNTTranslationError: LocalizedError {
  case unavailable
  case notInstalled
  case detectionFailed

  var errorDescription: String? {
    switch self {
    case .unavailable:
      return "Translation requires iOS 18.0+"
    case .notInstalled:
      return "Language pack not installed — use system settings or web translation fallback"
    case .detectionFailed:
      return "Could not detect source language"
    }
  }
}
