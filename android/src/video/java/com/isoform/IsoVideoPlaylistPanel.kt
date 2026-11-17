package com.isoform

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.net.URL
import kotlin.math.abs

/** One entry of the video list: its title and image address (empty = a play symbol). */
internal data class VideoPlaylistItem(val title: String, val image: String) {
  companion object {
    /** The entries from the `playlistItems` JSON (`[{ "title", "image" }]`). */
    fun parse(json: String?): List<VideoPlaylistItem> = runCatching {
      val array = JSONArray(json ?: "[]")
      (0 until array.length()).map { i ->
        val entry = array.getJSONObject(i)
        VideoPlaylistItem(entry.optString("title"), entry.optString("image"))
      }
    }.getOrDefault(emptyList())
  }
}

private val CARD_WIDTH = 168.dp
private val CARD_GAP = 16.dp

private val imageCache = LruCache<String, Bitmap>(24)

/** The image at `url`, downloaded once (`null` while loading, without one, or if it fails). */
@Composable
private fun rememberImage(url: String): Bitmap? =
  produceState(initialValue = imageCache.get(url), url) {
    value = if (url.isEmpty()) null else imageCache.get(url) ?: withContext(Dispatchers.IO) {
      runCatching { URL(url).openStream().use(BitmapFactory::decodeStream) }.getOrNull()
    }?.also { imageCache.put(url, it) }
  }.value

/**
 * The carousel of a video list, drawn natively for the fullscreen (where the React
 * Native panel cannot reach). Same look as the JS one: a dark panel over the lower
 * part of the video; the card in the middle is full size and outlined, its neighbors
 * shrink and fade with the distance; the scroll snaps to a card and the card it stops
 * on becomes the entry; tapping a card picks it and closes.
 */
@Composable
internal fun VideoPlaylistPanel(
  items: List<VideoPlaylistItem>,
  index: Int,
  onSelect: (Int) -> Unit,
  onClose: () -> Unit,
  modifier: Modifier = Modifier,
) {
  val row = rememberLazyListState(initialFirstVisibleItemIndex = index.coerceIn(0, (items.size - 1).coerceAtLeast(0)))
  val snap = rememberSnapFlingBehavior(lazyListState = row)
  var dragged by remember { mutableStateOf(false) }

  // the card nearest to the middle of the row (live while scrolling)
  val focus by remember {
    derivedStateOf {
      val info = row.layoutInfo
      val middle = (info.viewportStartOffset + info.viewportEndOffset) / 2
      info.visibleItemsInfo.minByOrNull { abs(it.offset + it.size / 2 - middle) }?.index ?: index
    }
  }

  // the entry changed from outside: glide to it
  LaunchedEffect(index) { row.animateScrollToItem(index) }

  // the card the user's scroll stops on becomes the entry
  LaunchedEffect(row.isScrollInProgress) {
    if (row.isScrollInProgress) {
      dragged = true
      return@LaunchedEffect
    }
    if (dragged && focus != index) onSelect(focus)
    dragged = false
  }

  Column(
    modifier
      .fillMaxWidth()
      .clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
      .background(Color(0xE6101012))
      // sides: only the camera cutout (as the controls do), so the close button sits at the screen edge in landscape
      .windowInsetsPadding(WindowInsets.displayCutout.only(WindowInsetsSides.Horizontal))
      // bottom: stay above the navigation bar; the side bars are not padded
      .windowInsetsPadding(WindowInsets.navigationBars.only(WindowInsetsSides.Bottom))
      .padding(top = 12.dp, bottom = 8.dp),
  ) {
    Row(Modifier.fillMaxWidth().padding(start = 18.dp, end = 12.dp), verticalAlignment = Alignment.CenterVertically) {
      // the title takes all the free width, so the counter and the close button never move while it changes with the scroll
      BasicText(
        items.getOrNull(focus)?.title.orEmpty(),
        Modifier.weight(1f),
        style = TextStyle(color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
      )
      Spacer(Modifier.width(8.dp))
      BasicText("${focus + 1} / ${items.size}", style = TextStyle(color = Color.White.copy(alpha = 0.6f), fontSize = 13.sp, fontFeatureSettings = "tnum"))
      Spacer(Modifier.width(10.dp))
      Box(
        Modifier
          .size(30.dp)
          .clip(CircleShape)
          .background(Color.White.copy(alpha = 0.14f))
          .clickable(onClick = onClose)
          .semantics { contentDescription = "Close playlist" },
        contentAlignment = Alignment.Center,
      ) { BasicText("✕", style = TextStyle(color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)) }
    }

    BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 10.dp)) {
      val side = ((maxWidth - CARD_WIDTH) / 2).coerceAtLeast(0.dp)
      val density = LocalDensity.current
      val step = with(density) { (CARD_WIDTH + CARD_GAP).toPx() }
      LazyRow(
        state = row,
        flingBehavior = snap,
        contentPadding = PaddingValues(horizontal = side),
        horizontalArrangement = Arrangement.spacedBy(CARD_GAP),
      ) {
        itemsIndexed(items) { i, item ->
          Card(
            item = item,
            focused = i == focus,
            current = i == index,
            modifier = Modifier.graphicsLayer {
              // distance to the middle, 0 (centered) … 1 (a card away)
              val info = row.layoutInfo
              val middle = (info.viewportStartOffset + info.viewportEndOffset) / 2f
              val card = info.visibleItemsInfo.firstOrNull { it.index == i }
              val distance = card?.let { (abs(it.offset + it.size / 2f - middle) / step).coerceIn(0f, 1f) } ?: 1f
              val scale = 1f - distance * 0.16f
              scaleX = scale
              scaleY = scale
              alpha = 1f - distance * 0.5f
            },
            onClick = {
              onSelect(i)
              onClose()
            },
          )
        }
      }
    }
  }
}

@Composable
private fun Card(item: VideoPlaylistItem, focused: Boolean, current: Boolean, modifier: Modifier, onClick: () -> Unit) {
  val image = rememberImage(item.image)
  Column(
    modifier
      .width(CARD_WIDTH)
      .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onClick)
      .semantics { contentDescription = item.title },
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Box(
      Modifier
        .fillMaxWidth()
        .aspectRatio(16f / 9f)
        .clip(RoundedCornerShape(12.dp))
        .background(Color.White.copy(alpha = 0.12f))
        .border(if (focused) 2.5.dp else 0.dp, if (focused) Color.White else Color.Transparent, RoundedCornerShape(12.dp)),
      contentAlignment = Alignment.Center,
    ) {
      BasicText("▶", style = TextStyle(color = Color.White.copy(alpha = 0.6f), fontSize = 22.sp))
      image?.let { Image(it.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
      if (current) {
        Box(
          Modifier.align(Alignment.BottomStart).padding(8.dp).clip(RoundedCornerShape(11.dp)).background(Color.Black.copy(alpha = 0.55f)).padding(horizontal = 7.dp, vertical = 3.dp),
        ) { BasicText("▮▮▮", style = TextStyle(color = Color.White, fontSize = 9.sp, letterSpacing = 1.sp)) }
      }
    }
    BasicText(
      item.title,
      Modifier.padding(top = 8.dp),
      style = TextStyle(
        color = if (focused) Color.White else Color.White.copy(alpha = 0.65f),
        fontSize = 12.5.sp,
        fontWeight = if (focused) FontWeight.SemiBold else FontWeight.Normal,
        textAlign = TextAlign.Center,
      ),
      maxLines = 2,
      overflow = TextOverflow.Ellipsis,
    )
  }
}
