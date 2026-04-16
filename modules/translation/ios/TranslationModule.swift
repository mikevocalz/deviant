import ExpoModulesCore

// MARK: - Expo Module
//
// Minimal stub — keeps the native module registered so requireOptionalNativeModule
// returns a non-null value, but throws a user-visible error from every function.
// The complex Apple Translation UIHostingController bridge is intentionally removed
// until native stability on the target OS is confirmed.

public class TranslationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Translation")

    AsyncFunction("translateText") { (_: String, _: String, _: String) async throws -> [String: Any] in
      throw NSError(
        domain: "TranslationModule",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "On-device translation is not available in this build"]
      )
    }

    AsyncFunction("isTranslationAvailable") { (_: String, _: String) async -> Bool in
      return false
    }

    AsyncFunction("downloadLanguagePack") { (_: String) async -> Void in
      // no-op
    }

    AsyncFunction("getAvailableLanguages") { () async -> [String] in
      return []
    }
  }
}
