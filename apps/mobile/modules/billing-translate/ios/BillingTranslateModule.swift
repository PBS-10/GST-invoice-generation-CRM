import ExpoModulesCore
import MLKitTranslate
import MLKitCommon

public class BillingTranslateModule: Module {
  private var translators: [String: Translator] = [:]

  public func definition() -> ModuleDefinition {
    Name("BillingTranslate")

    Function("isAvailable") { () -> Bool in
      true
    }

    AsyncFunction("isModelDownloaded") { (lang: String) -> Bool in
      let code = try self.requireLanguage(lang)
      let model = TranslateRemoteModel.translateRemoteModel(language: code)
      return ModelManager.modelManager().isModelDownloaded(model)
    }

    AsyncFunction("downloadModel") { (lang: String, wifiOnly: Bool) in
      let code = try self.requireLanguage(lang)
      // Download via a translator to English — ML Kit stores the language pack once.
      let translator = self.translatorFor(source: code, target: .english)
      let conditions = ModelDownloadConditions(
        allowsCellularAccess: !wifiOnly,
        allowsBackgroundDownloading: true
      )
      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        translator.downloadModelIfNeeded(with: conditions) { error in
          if let error {
            continuation.resume(throwing: error)
          } else {
            continuation.resume()
          }
        }
      }
    }

    AsyncFunction("deleteModel") { (lang: String) in
      let code = try self.requireLanguage(lang)
      let model = TranslateRemoteModel.translateRemoteModel(language: code)
      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        ModelManager.modelManager().deleteDownloadedModel(model) { error in
          if let error {
            continuation.resume(throwing: error)
          } else {
            let needle = code.rawValue
            self.translators = self.translators.filter { key, _ in
              !key.split(separator: "|").map(String.init).contains(needle)
            }
            continuation.resume()
          }
        }
      }
    }

    AsyncFunction("getDownloadedModels") { () -> [String] in
      ModelManager.modelManager().downloadedTranslateModels
        .map { $0.language.rawValue }
        .sorted()
    }

    AsyncFunction("translate") { (text: String, sourceLang: String, targetLang: String) -> String in
      let source = try self.requireLanguage(sourceLang)
      let target = try self.requireLanguage(targetLang)
      let translator = self.translatorFor(source: source, target: target)
      return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String, Error>) in
        translator.translate(text) { result, error in
          if let error {
            continuation.resume(throwing: error)
          } else {
            continuation.resume(returning: result ?? text)
          }
        }
      }
    }
  }

  private func requireLanguage(_ tag: String) throws -> TranslateLanguage {
    switch tag {
    case "hi":
      return .hindi
    case "ta":
      return .tamil
    case "en":
      return .english
    default:
      throw Exception(
        name: "ERR_UNSUPPORTED_LANGUAGE",
        description: "Unsupported language: \(tag)"
      )
    }
  }

  private func translatorFor(source: TranslateLanguage, target: TranslateLanguage) -> Translator {
    let key = "\(source.rawValue)|\(target.rawValue)"
    if let existing = translators[key] {
      return existing
    }
    let options = TranslatorOptions(sourceLanguage: source, targetLanguage: target)
    let translator = Translator.translator(options: options)
    translators[key] = translator
    return translator
  }
}
