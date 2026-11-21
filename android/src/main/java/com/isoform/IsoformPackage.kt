package com.isoform

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

/**
 * View managers dos módulos opcionais. Só os ligados no `isoform.config.json`
 * do app são compilados: por isso são achados pelo nome, e os que não estão no
 * build ficam de fora sem erro.
 */
private val MODULE_VIEW_MANAGERS = listOf(
  "com.isoform.IsoVideoViewManager", // isoform.video
  "com.isoform.IsoAudioViewManager", // isoform.audio
  "com.isoform.IsoPdfViewManager", // isoform.pdf
  "com.isoform.IsoSheetViewManager", // isoform.sheet
  "com.isoform.IsoCameraViewManager", // isoform.camera
  "com.isoform.IsoDatePickerViewManager", // isoform.datePicker
  "com.isoform.IsoImageViewManager", // isoform.image
  "com.isoform.IsoModalViewManager", // isoform.modal
  "com.isoform.IsoGestureViewManager", // isoform.gestures
)

/** TurboModules of the optional modules: JS name → class (found by name, like the view managers). */
private val MODULES = mapOf(
  "IsoImageModule" to "com.isoform.IsoImageModule", // isoform.image
)

private fun instantiate(className: String): ViewManager<*, *>? =
  runCatching { Class.forName(className).getDeclaredConstructor().newInstance() as ViewManager<*, *> }.getOrNull()

/** Class of a module, or `null` when its module is out of the build. */
private fun moduleClass(className: String): Class<*>? = runCatching { Class.forName(className) }.getOrNull()

/** Registrado pelo autolinking: expõe as views e os TurboModules dos módulos ligados. */
class IsoformPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    MODULES[name]?.let(::moduleClass)?.let {
      it.getDeclaredConstructor(ReactApplicationContext::class.java).newInstance(reactContext) as NativeModule
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    MODULES.filterValues { moduleClass(it) != null }.mapValues { (name, className) ->
      ReactModuleInfo(name, className, false, false, false, true)
    }
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    MODULE_VIEW_MANAGERS.mapNotNull(::instantiate)
}
