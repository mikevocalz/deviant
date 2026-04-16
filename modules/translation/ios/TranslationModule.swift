import ExpoModulesCore
import NaturalLanguage
import UIKit

// Apple Translation framework — iOS 17.4+
// Conditionally compiled so the module still builds on older SDKs.
#if canImport(Translation)
import Translation
import SwiftUI
#endif

// MARK: - Expo Module

public class TranslationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Translation")

    // ── translateText ──────────────────────────────────────────────────────
    AsyncFunction("translateText") {
      (text: String, sourceLanguage: String, targetLanguage: String) async throws -> [String: Any] in

      guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        return ["translatedText": text, "detectedSourceLanguage": ""]
      }

      // Normalise locale tag: "en-US" → "en"
      let tgtCode = targetLanguage.split(separator: "-").first.map(String.init) ?? targetLanguage

      // Resolve source language (auto-detect via NLLanguageRecognizer)
      let srcCode: String?
      if sourceLanguage == "auto" || sourceLanguage.isEmpty {
        srcCode = TranslationModule.detectCode(for: text)
      } else {
        srcCode = sourceLanguage.split(separator: "-").first.map(String.init) ?? sourceLanguage
      }

      // Skip translation when source == target
      if let src = srcCode, src == tgtCode {
        return ["translatedText": text, "detectedSourceLanguage": src]
      }

      #if canImport(Translation)
      if #available(iOS 17.4, *) {
        let srcLang = srcCode.flatMap { Locale.Language(identifier: $0) }
        let tgtLang = Locale.Language(identifier: tgtCode)

        let result = try await AppleTranslationBridge.translate(
          text: text, source: srcLang, target: tgtLang)

        return [
          "translatedText": result,
          "detectedSourceLanguage": srcCode ?? "",
        ]
      }
      #endif

      throw NSError(
        domain: "TranslationModule", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Translation requires iOS 17.4+"])
    }

    // ── isTranslationAvailable ─────────────────────────────────────────────
    AsyncFunction("isTranslationAvailable") {
      (sourceLanguage: String, targetLanguage: String) async -> Bool in

      #if canImport(Translation)
      if #available(iOS 17.4, *) {
        let avail = LanguageAvailability()
        let tgtCode = targetLanguage.split(separator: "-").first.map(String.init) ?? targetLanguage
        let tgt = Locale.Language(identifier: tgtCode)

        if sourceLanguage != "auto" && !sourceLanguage.isEmpty {
          let srcCode =
            sourceLanguage.split(separator: "-").first.map(String.init) ?? sourceLanguage
          let src = Locale.Language(identifier: srcCode)
          let status = await avail.status(from: src, to: tgt)
          return status != .unsupported
        }

        // Auto: check against common source languages
        for code in ["en", "es", "fr", "de", "zh", "ja", "ko", "ar", "ru", "pt", "it"] {
          let src = Locale.Language(identifier: code)
          let status = await avail.status(from: src, to: tgt)
          if status != .unsupported { return true }
        }
        return false
      }
      #endif
      return false
    }

    // ── detectLanguage ─────────────────────────────────────────────────────
    AsyncFunction("detectLanguage") { (text: String) async -> String in
      return TranslationModule.detectCode(for: text) ?? "und"
    }

    // ── downloadLanguagePack ───────────────────────────────────────────────
    // Apple Translation downloads models automatically on first use.
    AsyncFunction("downloadLanguagePack") { (_: String) async -> Void in }

    // ── getAvailableLanguages ──────────────────────────────────────────────
    AsyncFunction("getAvailableLanguages") { () async -> [String] in
      guard #available(iOS 17.4, *) else { return [] }
      return [
        "en", "es", "fr", "de", "it", "pt", "ja", "ko", "zh", "ar", "ru",
        "th", "vi", "pl", "nl", "tr", "id", "uk", "hi", "sv", "da", "fi",
        "nb", "cs", "hu", "ro", "sk", "bg", "hr", "ms",
      ]
    }
  }

  // MARK: - NLLanguageRecognizer (iOS 12+, no download required)

  fileprivate static func detectCode(for text: String) -> String? {
    let recognizer = NLLanguageRecognizer()
    // Feed enough text for reliable detection
    let sample = String(text.prefix(500))
    recognizer.processString(sample)
    guard let lang = recognizer.dominantLanguage, lang != .undetermined else {
      return nil
    }
    // NLLanguage rawValue is a BCP-47 code
    return lang.rawValue
  }
}

// MARK: - Apple Translation Bridge (iOS 17.4+)

#if canImport(Translation)
@available(iOS 17.4, *)
enum AppleTranslationBridge {

  // Entry point — dispatches UIKit work onto the main actor.
  static func translate(
    text: String,
    source: Locale.Language?,
    target: Locale.Language
  ) async throws -> String {
    try await Task { @MainActor in
      try await translateOnMain(text: text, source: source, target: target)
    }.value
  }

  // All UIKit calls must happen on the main thread.
  @MainActor
  private static func translateOnMain(
    text: String,
    source: Locale.Language?,
    target: Locale.Language
  ) async throws -> String {
    guard let rootVC = findRootViewController() else {
      throw NSError(
        domain: "TranslationModule", code: 2,
        userInfo: [NSLocalizedDescriptionKey: "No active foreground window"])
    }

    return try await withCheckedThrowingContinuation { continuation in
      mountAndTranslate(
        text: text, source: source, target: target,
        rootVC: rootVC, continuation: continuation)
    }
  }

  @MainActor
  private static func mountAndTranslate(
    text: String,
    source: Locale.Language?,
    target: Locale.Language,
    rootVC: UIViewController,
    continuation: CheckedContinuation<String, Error>
  ) {
    // Holder keeps vc alive and prevents double-resume
    let holder = BridgeHolder()

    let complete: (Result<String, Error>) -> Void = { result in
      guard !holder.finished else { return }
      holder.finished = true
      DispatchQueue.main.async {
        holder.vc?.willMove(toParent: nil)
        holder.vc?.view.removeFromSuperview()
        holder.vc?.removeFromParent()
        holder.vc = nil
      }
      continuation.resume(with: result)
    }

    let config = TranslationSession.Configuration(source: source, target: target)
    let bridge = TranslationBridgeView(text: text, config: config, onComplete: complete)
    let vc = UIHostingController(rootView: bridge)
    holder.vc = vc

    // Off-screen, invisible, non-interactive
    vc.view.frame = CGRect(x: -2, y: -2, width: 1, height: 1)
    vc.view.alpha = 0
    vc.view.isUserInteractionEnabled = false
    vc.view.backgroundColor = .clear

    rootVC.addChild(vc)
    rootVC.view.addSubview(vc.view)
    vc.didMove(toParent: rootVC)

    // 30-second safety timeout
    Task { @MainActor in
      try? await Task.sleep(nanoseconds: 30_000_000_000)
      complete(
        .failure(
          NSError(
            domain: "TranslationModule", code: 3,
            userInfo: [NSLocalizedDescriptionKey: "Translation timed out"])))
    }
  }

  // MARK: Root VC discovery — iOS 15+ key-window API

  @MainActor
  private static func findRootViewController() -> UIViewController? {
    for scene in UIApplication.shared.connectedScenes {
      guard let ws = scene as? UIWindowScene,
        ws.activationState == .foregroundActive
      else { continue }

      let window: UIWindow?
      if #available(iOS 15.0, *) {
        window = ws.keyWindow ?? ws.windows.first
      } else {
        window = ws.windows.first(where: { $0.isKeyWindow }) ?? ws.windows.first
      }

      if let root = window?.rootViewController {
        return topmost(of: root)
      }
    }
    return nil
  }

  private static func topmost(of vc: UIViewController) -> UIViewController {
    if let presented = vc.presentedViewController {
      return topmost(of: presented)
    }
    return vc
  }
}

// MARK: - SwiftUI Bridge View

@available(iOS 17.4, *)
private struct TranslationBridgeView: View {
  let text: String
  let config: TranslationSession.Configuration
  let onComplete: (Result<String, Error>) -> Void

  @State private var done = false

  var body: some View {
    Color.clear
      .frame(width: 0, height: 0)
      .translationTask(config) { session in
        guard !done else { return }
        done = true
        do {
          let response = try await session.translate(text)
          onComplete(.success(response.targetText))
        } catch {
          onComplete(.failure(error))
        }
      }
  }
}

// MARK: - Mutable bridge state (class — reference semantics)

private final class BridgeHolder {
  var vc: UIViewController?
  var finished = false
}
#endif
