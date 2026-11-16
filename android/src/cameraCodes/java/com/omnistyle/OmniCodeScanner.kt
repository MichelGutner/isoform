package com.omnistyle

import android.content.Context
import android.util.Size
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.UseCase
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.mlkit.vision.MlKitAnalyzer
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode

/** JS code kind → ML Kit format. */
private val FORMATS = mapOf(
  "qr" to Barcode.FORMAT_QR_CODE,
  "aztec" to Barcode.FORMAT_AZTEC,
  "data-matrix" to Barcode.FORMAT_DATA_MATRIX,
  "pdf417" to Barcode.FORMAT_PDF417,
  "ean-13" to Barcode.FORMAT_EAN_13,
  "ean-8" to Barcode.FORMAT_EAN_8,
  "upc-a" to Barcode.FORMAT_UPC_A,
  "upc-e" to Barcode.FORMAT_UPC_E,
  "code-128" to Barcode.FORMAT_CODE_128,
  "code-39" to Barcode.FORMAT_CODE_39,
  "code-93" to Barcode.FORMAT_CODE_93,
  "codabar" to Barcode.FORMAT_CODABAR,
  "itf" to Barcode.FORMAT_ITF,
)

private val TYPES = FORMATS.entries.associate { (type, format) -> format to type }

/**
 * Code scanner (`camera.codeScanner` on): ML Kit barcode scanning on CameraX frames
 * through `MlKitAnalyzer` (it handles rotation and frame lifetimes). Frames are
 * analyzed at about 720p, dropping the ones that arrive while busy. [onCodes] only
 * runs when the codes in sight change.
 */
internal class OmniCodeScanner(private val context: Context, private val onCodes: (List<Pair<String, String>>) -> Unit) {
  private var scanner: BarcodeScanner? = null
  private var analysis: ImageAnalysis? = null
  private var last: Set<Pair<String, String>> = emptySet()

  /** The analysis use case for these kinds (`qr`, `ean-13`…); a new one when the kinds change. */
  fun useCase(types: List<String>, rotation: Int): UseCase {
    release()
    val formats = types.mapNotNull(FORMATS::get).ifEmpty { listOf(Barcode.FORMAT_QR_CODE) }
    val client = BarcodeScanning.getClient(
      BarcodeScannerOptions.Builder().setBarcodeFormats(formats.first(), *formats.drop(1).toIntArray()).build(),
    )
    val executor = ContextCompat.getMainExecutor(context)
    val useCase = ImageAnalysis.Builder()
      .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
      .setResolutionSelector(
        ResolutionSelector.Builder()
          .setResolutionStrategy(ResolutionStrategy(Size(1280, 720), ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER))
          .build(),
      )
      .setTargetRotation(rotation)
      .build()
    useCase.setAnalyzer(executor, MlKitAnalyzer(listOf(client), ImageAnalysis.COORDINATE_SYSTEM_ORIGINAL, executor) { result ->
      val codes = result.getValue(client).orEmpty().mapNotNull { code ->
        val type = TYPES[code.format] ?: return@mapNotNull null
        (code.rawValue ?: return@mapNotNull null) to type
      }
      val seen = codes.toSet()
      if (seen != last) {
        last = seen
        onCodes(codes)
      }
    })
    scanner = client
    analysis = useCase
    return useCase
  }

  fun setRotation(rotation: Int) {
    analysis?.targetRotation = rotation
  }

  fun release() {
    analysis?.clearAnalyzer()
    scanner?.close()
    analysis = null
    scanner = null
    last = emptySet()
  }
}
