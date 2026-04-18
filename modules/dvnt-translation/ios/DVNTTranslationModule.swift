import ExpoModulesCore
import NaturalLanguage
import UIKit

// Apple Translation framework — iOS 18.0+
// Conditionally compiled so the module still builds on older SDKs.
#if canImport(Translation)
import Translation
import SwiftUI
#endif

// MARK: - Expo Module

public class DVNTTranslationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DVNTTranslation")

    // ── translateText ──────────────────────────────────────────────────────
    AsyncFunction("translateText") {
      (text: String, sourceLanguage: String, targetLanguage: String) async throws -> [String: Any] in

      guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        return ["translatedText": text, "detectedSourceLanguage": ""]
      }

      let tgtCode = targetLanguage.split(separator: "-").first.map(String.init) ?? targetLanguage

      let srcCode: String?
      if sourceLanguage == "auto" || sourceLanguage.isEmpty {
        srcCode = DVNTTranslationModule.detectCode(for: text)
      } else {
        srcCode = sourceLanguage.split(separator: "-").first.map(String.init) ?? sourceLanguage
      }

      if let src = srcCode, src == tgtCode {
        return ["translatedText": text, "detectedSourceLanguage": src]
      }

      #if canImport(Translation)
      if #available(iOS 18.0, *) {
        let srcLang = srcCode.flatMap { Locale.Language(identifier: $0) }
        let tgtLang = Locale.Language(identifier: tgtCode)

        let result = try await DVNTAppleTranslationBridge.translate(
          text: text, source: srcLang, target: tgtLang)

        return [
          "translatedText": result,
          "detectedSourceLanguage": srcCode ?? "",
        ]
      }
      #endif

      throw NSError(
        domain: "DVNTTranslation", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Translation requires iOS 18.0+"])
    }

    // ── isTranslationAvailable ─────────────────────────────────────────────
    AsyncFunction("isTranslationAvailable") {
      (sourceLanguage: String, targetLanguage: String) async -> Bool in

      #if canImport(Translation)
      if #available(iOS 18.0, *) {
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
      return DVNTTranslationModule.detectCode(for: text) ?? "und"
    }

    // ── downloadLanguagePack ───────────────────────────────────────────────
    AsyncFunction("downloadLanguagePack") { (_: String) async -> Void in }

    // ── getAvailableLanguages ──────────────────────────────────────────────
    AsyncFunction("getAvailableLanguages") { () async -> [String] in
      guard #available(iOS 18.0, *) else { return [] }
      return [
        "en", "es", "fr", "de", "it", "pt", "ja", "ko", "zh", "ar", "ru",
        "th", "vi", "pl", "nl", "tr", "id", "uk", "hi", "sv", "da", "fi",
        "nb", "cs", "hu", "ro", "sk", "bg", "hr", "ms",
      ]
    }
  }

  // MARK: - NLLanguageRecognizer (iOS 12+)

  fileprivate static func detectCode(for text: String) -> String? {
    let recognizer = NLLanguageRecognizer()
    recognizer.processString(String(text.prefix(500)))
    guard let lang = recognizer.dominantLanguage, lang != .undetermined else {
      return nil
    }
    return lang.rawValue
  }
}

// MARK: - Apple Translation Bridge (iOS 18.0+)

#if canImport(Translation)
@available(iOS 18.0, *)
enum DVNTAppleTranslationBridge {

  static func translate(
    text: String,
    source: Locale.Language?,
    target: Locale.Language
  ) async throws -> String {
    try await Task { @MainActor in
      try await translateOnMain(text: text, source: source, target: target)
    }.value
  }

  @MainActor
  private static func translateOnMain(
    text: String,
    source: Locale.Language?,
    target: Locale.Language
  ) async throws -> String {
    guard let rootVC = findRootViewController() else {
      throw NSError(
        domain: "DVNTTranslation", code: 2,
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
    let holder = DVNTBridgeHolder()

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
    let bridge = DVNTTranslationBridgeView(text: text, config: config, onComplete: complete)
    let vc = UIHostingController(rootView: bridge)
    holder.vc = vc

    vc.view.frame = CGRect(x: -2, y: -2, width: 1, height: 1)
    vc.view.alpha = 0
    vc.view.isUserInteractionEnabled = false
    vc.view.backgroundColor = .clear

    rootVC.addChild(vc)
    rootVC.view.addSubview(vc.view)
    vc.didMove(toParent: rootVC)

    Task { @MainActor in
      try? await Task.sleep(nanoseconds: 30_000_000_000)
      complete(
        .failure(
          NSError(
            domain: "DVNTTranslation", code: 3,
            userInfo: [NSLocalizedDescriptionKey: "Translation timed out"])))
    }
  }

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

@available(iOS 18.0, *)
private struct DVNTTranslationBridgeView: View {
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

// MARK: - Bridge state holder

private final class DVNTBridgeHolder {
  var vc: UIViewController?
  var finished = false
}
#endif
