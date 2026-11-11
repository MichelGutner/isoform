/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { isReversed, type EasingFn, type TrackPlan } from './animation';

/** Animação pronta para executar (montada em `compileStyle`, cacheada pelo builder). */
export interface NativeAnimation {
  /** Identidade: muda → a animação reinicia (como trocar `animation-name` no CSS). */
  key: string;
  duration: number;
  delay: number;
  easing: EasingFn;
  iterations: number;
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  fill: 'none' | 'forwards' | 'backwards' | 'both';
  paused: boolean;
  plan: TrackPlan;
}

function animatedStyle(plan: TrackPlan, progress: Animated.Value): Record<string, any> {
  const style: Record<string, any> = {};
  for (const key of Object.keys(plan.props)) {
    style[key] = progress.interpolate(plan.props[key] as any);
  }
  if (plan.transform.length) {
    style.transform = plan.transform.map(({ fn, track }) => ({
      [fn]: progress.interpolate(track as any),
    }));
  }
  return style;
}

const hosts = new WeakMap<React.ComponentType<any>, React.ComponentType<any>>();

/**
 * Envolve um componente RN num host que executa a animação com `Animated`.
 * Cacheado por componente: a mesma entrada devolve sempre o mesmo host.
 */
export function animatedHost(Component: React.ComponentType<any>): React.ComponentType<any> {
  let Host = hosts.get(Component);
  if (Host) return Host;

  const AnimatedComponent = Animated.createAnimatedComponent(Component as any) as any;

  const Created = forwardRef<any, any>(({ __omniAnimation: anim, style, ...rest }, ref) => {
    const spec = anim as NativeAnimation;
    const startsBackwards = isReversed(spec.direction, 0);
    const progress = useRef(new Animated.Value(startsBackwards ? 1 : 0)).current;

    // Antes de começar (delay), o estilo animado só vale com fill backwards/both.
    const showsDuringDelay = spec.fill === 'backwards' || spec.fill === 'both';
    const [active, setActive] = useState(spec.delay <= 0 || showsDuringDelay || spec.paused);

    useEffect(() => {
      setActive(spec.delay <= 0 || showsDuringDelay || spec.paused);
      progress.setValue(isReversed(spec.direction, 0) ? 1 : 0);
      if (spec.paused) return undefined;

      let cancelled = false;
      let current: Animated.CompositeAnimation | undefined;

      const run = (i: number) => {
        const from = isReversed(spec.direction, i) ? 1 : 0;
        progress.setValue(from);
        current = Animated.timing(progress, {
          toValue: 1 - from,
          duration: spec.duration,
          easing: spec.easing,
          useNativeDriver: spec.plan.nativeDriver,
          isInteraction: false,
        });
        current.start(({ finished }) => {
          if (!finished || cancelled) return;
          if (i + 1 < spec.iterations) run(i + 1);
          else if (spec.fill === 'none' || spec.fill === 'backwards') setActive(false);
        });
      };

      const timer = setTimeout(() => {
        if (cancelled) return;
        setActive(true);
        run(0);
      }, Math.max(0, spec.delay));

      return () => {
        cancelled = true;
        clearTimeout(timer);
        current?.stop();
      };
    }, [spec.key]);

    const animated = useMemo(() => animatedStyle(spec.plan, progress), [spec.key]);

    return React.createElement(AnimatedComponent, {
      ...rest,
      ref,
      style: active ? [style, animated] : style,
    });
  });

  Created.displayName = `Animated(${(Component as any).displayName || (Component as any).name || 'Component'})`;
  Host = Created;
  hosts.set(Component, Host);
  return Host;
}
