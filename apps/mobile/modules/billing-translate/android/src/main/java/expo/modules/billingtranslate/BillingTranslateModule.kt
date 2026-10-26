package expo.modules.billingtranslate

import com.google.android.gms.tasks.Tasks
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.ConcurrentHashMap

class BillingTranslateModule : Module() {
  private val translators = ConcurrentHashMap<String, Translator>()
  private val modelManager = RemoteModelManager.getInstance()

  override fun definition() = ModuleDefinition {
    Name("BillingTranslate")

    Function("isAvailable") {
      true
    }

    AsyncFunction("isModelDownloaded") Coroutine { lang: String ->
      val code = requireLanguage(lang)
      val downloaded = Tasks.await(modelManager.getDownloadedModels(TranslateRemoteModel::class.java))
      downloaded.any { it.language == code }
    }

    AsyncFunction("downloadModel") Coroutine { lang: String, wifiOnly: Boolean ->
      val code = requireLanguage(lang)
      val model = TranslateRemoteModel.Builder(code).build()
      val conditionsBuilder = DownloadConditions.Builder()
      if (wifiOnly) {
        conditionsBuilder.requireWifi()
      }
      Tasks.await(modelManager.download(model, conditionsBuilder.build()))
      Unit
    }

    AsyncFunction("deleteModel") Coroutine { lang: String ->
      val code = requireLanguage(lang)
      val model = TranslateRemoteModel.Builder(code).build()
      Tasks.await(modelManager.deleteDownloadedModel(model))
      translators.keys
        .filter { it.startsWith("$code|") || it.endsWith("|$code") }
        .forEach { key ->
          translators.remove(key)?.close()
        }
      Unit
    }

    // Explicit `->` so Kotlin picks zero-arg Coroutine, not the one-arg overload.
    AsyncFunction("getDownloadedModels") Coroutine { ->
      val downloaded = Tasks.await(modelManager.getDownloadedModels(TranslateRemoteModel::class.java))
      downloaded.map { it.language }.sorted()
    }

    AsyncFunction("translate") Coroutine { text: String, sourceLang: String, targetLang: String ->
      val source = requireLanguage(sourceLang)
      val target = requireLanguage(targetLang)
      val translator = translatorFor(source, target)
      Tasks.await(translator.translate(text))
    }

    OnDestroy {
      translators.values.forEach { it.close() }
      translators.clear()
    }
  }

  private fun requireLanguage(tag: String): String {
    val code = TranslateLanguage.fromLanguageTag(tag)
      ?: throw CodedException("ERR_UNSUPPORTED_LANGUAGE", "Unsupported language: $tag", null)
    return code
  }

  private fun translatorFor(source: String, target: String): Translator {
    val key = "$source|$target"
    return translators.getOrPut(key) {
      val options = TranslatorOptions.Builder()
        .setSourceLanguage(source)
        .setTargetLanguage(target)
        .build()
      Translation.getClient(options)
    }
  }
}
