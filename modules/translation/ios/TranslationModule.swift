import ExpoModulesCore
import SwiftUI
import UIKit

#if canImport(Translation)
import Translation
#endif

// MARK: - Expo Module

public class TranslationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Translation")

    AsyncFunction("translateText") { (text: String, sourceLanguage: String, targetLanguage: String) async throws -> [String: Any] in
      guard #available(iOS 17.4, *) else {
        throw NSError(
          domain: "TranslationModule",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Translation requires iOS 17.4 or later"]
        )
      }
      let translated = try await AppleTranslationBridge.translate(
        text: text,
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage
      )
      return [
        "translatedText": translated,
        "sourceLanguage": sourceLanguage,
        "confidence": 1.0,
      ]
    }

    AsyncFunction("isTranslationAvailable") { (sourceLanguage: String, targetLanguage: String) async -> Bool in
      guard #available(iOS 17.4, *) else { return false }
      let known = ["en","es","fr","de","it","pt","ja","ko","zh","ar","ru","th","vi","pl","nl","tr","id","uk","hi","sv","da","fi","nb","cs","hu","ro","sk","bg","hr","ms"]
      return known.contains(sourceLanguage) && known.contains(targetLanguage)
    }

    AsyncFunction("downloadLanguagePack") { (_: String) async -> Void in
      // Apple Translation downloads models automatically on demand; nothing to do here.
    }

    AsyncFunction("getAvailableLanguages") { () async -> [String] in
      guard #available(iOS 17.4, *) else { return [] }
      return ["en","es","fr","de","it","pt","ja","ko","zh","ar","ru","th","vi","pl","nl","tr","id","uk","hi","sv","da","fi","nb","cs","hu","ro","sk","bg","hr","ms"]
    }
  }
}

// MARK: - Apple Translation Bridge

@available(iOS 17.4, *)
enum AppleTranslationBridge {

  /// Translates `text` using Apple's on-device Translation framework.
  /// Bridges the SwiftUI `translationTask` API to async/await by mounting a
  /// hidden `UIHostingController` into the key-window's root view controller.
  static func translate(
    text: String,
    sourceLanguage: String,
    targetLanguage: String
  ) async throws -> String {
    let source: Locale.Language? = sourceLanguage == "auto" ? nil : Locale.Language(identifier: sourceLanguage)
    let target = Locale.Language(identifier: targetLanguage)
    let config = TranslationSession.Configuration(source: source, target: target)

    return try await withCheckedThrowingContinuation { continuation in
      DispatchQueue.main.async {
        mountAndTranslate(text: text, config: config, continuation: continuation)
      }
    }
  }

  @MainActor
  private static func mountAndTranslate(
    text: String,
    config: TranslationSession.Configuration,
    continuation: CheckedContinuation<String, Error>
  ) {
    guard
      let scene = UIApplication.shared.connectedScenes
        .compactMap({ $0 as? UIWindowScene })
        .first(where: { $0.activationState == .foregroundActive }),
      let window = scene.windows.first(where: { $0.isKeyWindow }),
      let rootVC = window.rootViewController
    else {
      continuation.resume(throwing: NSError(
        domain: "TranslationModule",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "No active key window found"]
      ))
      return
    }

    // Use a holder to keep the VC alive and allow the bridge view to remove it.
    let holder = TranslationVCHolder()

    let bridgeView = TranslationBridgeView(
      text: text,
      config: config,
      onComplete: { result in
        // Called from the translationTask closure (main actor).
        holder.hostingVC?.willMove(toParent: nil)
        holder.hostingVC?.view.removeFromSuperview()
        holder.hostingVC?.removeFromParent()
        holder.hostingVC = nil
        continuation.resume(with: result)
      }
    )

    let hostingVC = UIHostingController(rootView: bridgeView)
    holder.hostingVC = hostingVC

    // Place it off-screen and invisible so it doesn't affect the UI.
    hostingVC.view.frame = CGRect(x: -2, y: -2, width: 1, height: 1)
    hostingVC.view.alpha = 0
    hostingVC.view.isUserInteractionEnabled = false

    rootVC.addChild(hostingVC)
    rootVC.view.addSubview(hostingVC.view)
    hostingVC.didMove(toParent: rootVC)

    // Retain the holder for the lifetime of the hosting VC.
    objc_setAssociatedObject(
      hostingVC,
      &TranslationAssociatedKeys.holder,
      holder,
      .OBJC_ASSOCIATION_RETAIN_NONATOMIC
    )
  }
}

// MARK: - SwiftUI Bridge View

@available(iOS 17.4, *)
private struct TranslationBridgeView: View {
  let text: String
  let config: TranslationSession.Configuration
  let onComplete: (Result<String, Error>) -> Void

  @State private var triggered = false

  var body: some View {
    Color.clear
      .frame(width: 1, height: 1)
      .translationTask(config) { session in
        guard !triggered else { return }
        triggered = true
        do {
          let response = try await session.translate(text)
          onComplete(.success(response.targetText))
        } catch {
          onComplete(.failure(error))
        }
      }
  }
}

// MARK: - Supporting Types

@available(iOS 17.4, *)
private final class TranslationVCHolder {
  var hostingVC: UIViewController?
}

private enum TranslationAssociatedKeys {
  static var holder = "translationHolder"
}
