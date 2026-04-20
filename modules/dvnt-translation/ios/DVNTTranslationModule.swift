import ExpoModulesCore
import NaturalLanguage

// Apple Translation framework — iOS 17.4+, programmatic access iOS 18.0+.
// Weak-linked via podspec so the binary loads on iOS < 17.4 without crashing.
#if canImport(Translation)
import Translation
#endif

// MARK: - Module

public class DVNTTranslationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DVNTTranslation")

    // ── isTranslationAvailable ─────────────────────────────────────────────
    AsyncFunction("isTranslationAvailable") {
      (sourceLanguage: String, targetLanguage: String) async -> Bool in
      guard #available(iOS 18.0, *) else { return false }
      #if canImport(Translation)
      return await DVNTTranslationModule.checkAvailable(
        source: sourceLanguage, target: targetLanguage)
      #else
      return false
      #endif
    }

    // ── getAvailabilityStatus ──────────────────────────────────────────────
    AsyncFunction("getAvailabilityStatus") {
      (sourceLanguage: String, targetLanguage: String) async -> String in
      guard #available(iOS 18.0, *) else { return "unsupported" }
      #if canImport(Translation)
      return await DVNTTranslationModule.availabilityStatus(
        source: sourceLanguage, target: targetLanguage)
      #else
      return "unsupported"
      #endif
    }

    // ── detectLanguage ─────────────────────────────────────────────────────
    AsyncFunction("detectLanguage") {
      (text: String) async -> String in
      return DVNTTranslationModule.detectCode(text)
    }

    // ── translateText ──────────────────────────────────────────────────────
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
      if let src = srcCode, src == tgtCode {
        return ["translatedText": text, "detectedSourceLanguage": src]
      }
      let srcLang: Locale.Language? = srcCode.map { Locale.Language(identifier: $0) }
      let tgtLang = Locale.Language(identifier: tgtCode)
      let translated = try await DVNTTranslationModule.translate(
        text: text, source: srcLang, target: tgtLang)
      return ["translatedText": translated, "detectedSourceLanguage": srcCode ?? ""]
      #else
      throw DVNTTranslationError.unavailable
      #endif
    }

    // ── translateBatch ─────────────────────────────────────────────────────
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
          let translated = try await DVNTTranslationModule.translate(
            text: item, source: srcLang, target: tgtLang)
          results.append(["originalText": item, "translatedText": translated, "success": true])
        } catch {
          results.append([
            "originalText": item, "translatedText": item,
            "success": false, "error": error.localizedDescription,
          ])
        }
      }
      return results
      #else
      throw DVNTTranslationError.unavailable
      #endif
    }

    // ── downloadLanguagePack ───────────────────────────────────────────────
    // No-op stub for JS API symmetry.
    // System downloads are handled automatically by TranslationSession.prepareTranslation().
    // Manual download APIs were removed from the Translation framework in Xcode 26 SDK.
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

  // MARK: - Translation core

  #if canImport(Translation)

  // Translates a single string.
  //
  // iOS 26.0+  — TranslationSession(installedSource:target:) is the new SDK-preferred
  //              initializer for packs that are already installed on-device.
  //              For packs that are present but not installed (.supported), the JS layer
  //              falls back to a web service; there is no programmatic download API in
  //              the iOS 26 SDK (LanguageAvailability.downloadLanguage was removed).
  //
  // iOS 18.0–25.x — TranslationSession(configuration:) + prepareTranslation() is the
  //              stable programmatic path.  prepareTranslation() triggers the system
  //              download sheet when a pack is not yet installed, which is the intended
  //              UX for that OS range.
  @available(iOS 18.0, *)
  static func translate(
    text: String,
    source: Locale.Language?,
    target: Locale.Language
  ) async throws -> String {
    let resolvedSrc: Locale.Language
    if let src = source {
      resolvedSrc = src
    } else {
      let detected = detectCode(text)
      guard detected != "und" else { throw DVNTTranslationError.detectionFailed }
      resolvedSrc = Locale.Language(identifier: detected)
    }

    if resolvedSrc.languageCode == target.languageCode {
      return text
    }

    // Fail fast for unsupported pairs before creating a session.
    let avail = LanguageAvailability()
    let status = await avail.status(from: resolvedSrc, to: target)
    guard status != .unsupported else { throw DVNTTranslationError.notInstalled }

    if #available(iOS 26.0, *) {
      // iOS 26+: use new initializer for installed packs.
      // .supported (not yet downloaded) has no programmatic download path in this SDK;
      // throw so the JS layer can route to a web translation fallback.
      switch status {
      case .installed:
        let session = TranslationSession(installedSource: resolvedSrc, target: target)
        let response = try await session.translate(text)
        return response.targetText
      default:
        throw DVNTTranslationError.notInstalled
      }
    } else {
      // iOS 18.0–25.x: configuration-based programmatic API (stable since iOS 17.4).
      // prepareTranslation() will trigger a system sheet to download the pack if
      // status is .supported; translate(requests:) runs once ready.
      let config = TranslationSession.Configuration(source: resolvedSrc, target: target)
      let session = TranslationSession(configuration: config)
      try await session.prepareTranslation()
      let responses = try await session.translate(requests: [TranslationRequest(sourceText: text)])
      guard let first = responses.first else { throw DVNTTranslationError.notInstalled }
      return first.targetText
    }
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
