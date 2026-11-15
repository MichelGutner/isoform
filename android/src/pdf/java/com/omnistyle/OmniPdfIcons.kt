package com.omnistyle

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.unit.dp

/**
 * Icons of the Android `Pdf` toolbar: the same 24×24 SVG paths as the web viewer,
 * turned into vectors (no icon library). `stroke` paths are outlines, `fill` paths are solid.
 */
internal enum class PdfIcon(val stroke: List<String> = emptyList(), val fill: List<String> = emptyList()) {
  Pages(
    stroke = listOf(
      "M5 4.5h4a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-12a1.5 1.5 0 0 1 1.5-1.5z",
      "M15 4.5h4a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-12a1.5 1.5 0 0 1 1.5-1.5z",
    ),
  ),
  Search(stroke = listOf("M17 10.5a6.5 6.5 0 1 1-13 0a6.5 6.5 0 1 1 13 0z", "M15.5 15.5L20 20")),
  More(fill = listOf("M7.2 12a1.7 1.7 0 1 1-3.4 0a1.7 1.7 0 1 1 3.4 0zM13.7 12a1.7 1.7 0 1 1-3.4 0a1.7 1.7 0 1 1 3.4 0zM20.2 12a1.7 1.7 0 1 1-3.4 0a1.7 1.7 0 1 1 3.4 0z")),
  Up(stroke = listOf("M6 14.5l6-6 6 6")),
  Down(stroke = listOf("M6 9.5l6 6 6-6")),
  Close(stroke = listOf("M6.5 6.5l11 11M17.5 6.5l-11 11")),
  Speaker(
    stroke = listOf("M16 9.2a4 4 0 0 1 0 5.6", "M18.6 6.6a7.6 7.6 0 0 1 0 10.8"),
    fill = listOf("M3.5 9.6v4.8a1 1 0 0 0 1 1h3l4.2 3.5a.7.7 0 0 0 1.15-.54V5.64a.7.7 0 0 0-1.15-.54L7.5 8.6h-3a1 1 0 0 0-1 1z"),
  ),
  Stop(fill = listOf("M8.5 6.5h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z")),
  Fullscreen(stroke = listOf("M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5")),
  ExitFullscreen(stroke = listOf("M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5")),
  Moon(stroke = listOf("M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z")),
  FitWidth(stroke = listOf("M4 12h16M7.5 8.5L4 12l3.5 3.5M16.5 8.5L20 12l-3.5 3.5")),
  FitPage(stroke = listOf("M8 4.5H4.5V8M16 4.5h3.5V8M8 19.5H4.5V16M16 19.5h3.5V16")),
  Lock(stroke = listOf("M7 10.5h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z", "M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7")),
  Check(stroke = listOf("M5 12.5l4.5 4.5L19 7.5")),
  ;

  /** Built once per icon. */
  val vector: ImageVector by lazy { build() }

  private fun build(): ImageVector =
    ImageVector.Builder(name = name, defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f)
      .apply {
        fill.forEach { addPath(pathData = addPathNodes(it), fill = SolidColor(Color.Black)) }
        stroke.forEach {
          addPath(
            pathData = addPathNodes(it),
            stroke = SolidColor(Color.Black),
            strokeLineWidth = 1.9f,
            strokeLineCap = StrokeCap.Round,
            strokeLineJoin = StrokeJoin.Round,
          )
        }
      }
      .build()
}

/** An icon tinted with `color`. */
@Composable
internal fun PdfIconImage(icon: PdfIcon, color: Color, size: Int = 22) {
  Image(
    painter = rememberVectorPainter(icon.vector),
    contentDescription = null,
    colorFilter = ColorFilter.tint(color),
    modifier = Modifier.size(size.dp),
  )
}
