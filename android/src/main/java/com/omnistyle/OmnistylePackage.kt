package com.omnistyle

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * View managers dos módulos opcionais. Só os ligados no `omnistyle.config.json`
 * do app são compilados: por isso são achados pelo nome, e os que não estão no
 * build ficam de fora sem erro.
 */
private val MODULE_VIEW_MANAGERS = listOf(
  "com.omnistyle.OmniVideoViewManager", // omnistyle.video
  "com.omnistyle.OmniAudioViewManager", // omnistyle.audio
  "com.omnistyle.OmniPdfViewManager", // omnistyle.pdf
)

private fun instantiate(className: String): ViewManager<*, *>? =
  runCatching { Class.forName(className).getDeclaredConstructor().newInstance() as ViewManager<*, *> }.getOrNull()

/** Registrado pelo autolinking: expõe as views nativas dos módulos ligados. */
class OmnistylePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = emptyList()

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    MODULE_VIEW_MANAGERS.mapNotNull(::instantiate)
}
