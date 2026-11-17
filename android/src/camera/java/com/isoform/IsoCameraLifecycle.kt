package com.isoform

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry

/**
 * The lifecycle CameraX binds to, one per camera view. It follows the screen's
 * lifecycle but stops at `CREATED` (camera closed) whenever the view should not run
 * it: detached, `active={false}`, or without permission. Two cameras on screen
 * therefore never fight over the activity's lifecycle.
 */
internal class IsoCameraLifecycle : LifecycleOwner {
  private val registry = LifecycleRegistry(this).apply { currentState = Lifecycle.State.CREATED }

  override val lifecycle: Lifecycle get() = registry

  /** Moves to [state]; nothing happens once destroyed. */
  fun moveTo(state: Lifecycle.State) {
    if (registry.currentState == Lifecycle.State.DESTROYED || registry.currentState == state) return
    registry.currentState = state
  }

  /** Closes the camera for good (the view was dropped). */
  fun destroy() = moveTo(Lifecycle.State.DESTROYED)
}
