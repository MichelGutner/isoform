/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { flattenStyle } from '../../core/flatten';
import { IDENTITY, interpolatable, parseTransform } from './animation';
import {
  lerpValue,
  sameValue,
  warnUnsupportedTransition,
  type ResolvedTiming,
  type ResolvedTransition,
} from './transition';

type TransformMap = Record<string, number | string>;

/** Uma propriedade em transição: de onde veio, para onde vai e o progresso (0 → 1). */
interface Track {
  from: any;
  to: any;
  /**
   * Progresso da transição atual. Cada transição ganha um valor novo: o anterior continua ligado à
   * view montada até o commit, e zerá-lo no render mostraria por um quadro a cor de duas trocas atrás.
   */
  progress: Animated.Value;
  /** Último progresso conhecido (para retomar de onde parou se a transição for interrompida). */
  last: number;
  timing: ResolvedTiming;
  /** Nó animado (cacheado enquanto from/to não mudam). */
  node?: any;
  kind: 'value' | 'transform';
  /** Transição decidida no render e ainda não iniciada (começa no efeito, depois do commit). */
  pending: boolean;
  /** Progressos de transições substituídas, parados depois do commit. */
  retired: Animated.Value[];
}

/** Dá ao track um progresso novo começando em `start`; só ele atualiza `last`. */
function freshProgress(track: Track, start: number): void {
  const progress = new Animated.Value(start);
  progress.addListener(({ value }) => {
    if (track.progress === progress) track.last = value;
  });
  track.progress = progress;
  track.last = start;
}

function retire(progress: Animated.Value): void {
  progress.stopAnimation();
  progress.removeAllListeners();
}

const toMap = (list: Array<{ fn: string; value: number | string }>): TransformMap => {
  const map: TransformMap = {};
  for (const { fn, value } of list) map[fn] = value;
  return map;
};

/** Valor da propriedade entre `from` e `to` no progresso `t` (para retomar uma transição interrompida). */
function currentValue(track: Track, t: number): any {
  // nos extremos o valor é exatamente o de origem/destino (sem recalcular nem trocar de notação)
  if (t >= 1) return track.to;
  if (t <= 0) return track.from;
  if (track.kind === 'transform') {
    const out: TransformMap = {};
    for (const fn of new Set([...Object.keys(track.from), ...Object.keys(track.to)])) {
      const a = track.from[fn] ?? IDENTITY[fn];
      const b = track.to[fn] ?? IDENTITY[fn];
      out[fn] = lerpValue(a, b, t) ?? b;
    }
    return out;
  }
  return lerpValue(track.from, track.to, t) ?? track.to;
}

/** Nó animado de uma propriedade (ou o valor puro quando não dá para interpolar). */
function buildNode(track: Track): any {
  if (track.kind === 'transform') {
    const fns = [...new Set([...Object.keys(track.from), ...Object.keys(track.to)])];
    return fns.map((fn) => {
      const a = track.from[fn] ?? IDENTITY[fn];
      const b = track.to[fn] ?? IDENTITY[fn];
      return {
        [fn]: interpolatable([a, b])
          ? track.progress.interpolate({ inputRange: [0, 1], outputRange: [a, b] } as any)
          : b,
      };
    });
  }
  if (!interpolatable([track.from, track.to])) return track.to;
  return track.progress.interpolate({ inputRange: [0, 1], outputRange: [track.from, track.to] } as any);
}

const hosts = new WeakMap<React.ComponentType<any>, React.ComponentType<any>>();

/**
 * Envolve um componente RN num host que anima as mudanças do estilo final
 * conforme `transition` (props, estados `pressed`/`focus`, breakpoints, tema).
 * A primeira renderização não anima; só as mudanças seguintes.
 *
 * Uma transição interrompida continua de onde estava (números, cores e
 * strings com os mesmos números); nos demais casos recomeça do valor anterior.
 */
export function transitionHost(Component: React.ComponentType<any>): React.ComponentType<any> {
  let Host = hosts.get(Component);
  if (Host) return Host;

  const Created = forwardRef<any, any>(({ __isoTransition: tr, style, ...rest }, ref) => {
    const spec = tr as ResolvedTransition;
    const store = useRef(new Map<string, Track>()).current;

    const flat = flattenStyle(style);
    const animated: Record<string, any> = { ...flat };

    for (const key of Object.keys(flat)) {
      const timing = spec.props[key] ?? spec.all;
      const raw = flat[key];
      if (!timing || raw === undefined || raw === null) continue;

      const isTransform = key === 'transform';
      if (!isTransform && typeof raw !== 'number' && typeof raw !== 'string') continue;
      if (!isTransform && key.startsWith('__')) continue;

      const target = isTransform ? toMap(parseTransform(raw)) : raw;
      let track = store.get(key);

      if (!track) {
        const created = {
          from: target,
          to: target,
          timing,
          kind: isTransform ? 'transform' : 'value',
          pending: false,
          retired: [],
        } as unknown as Track;
        freshProgress(created, 1);
        store.set(key, created);
        track = created;
      } else if (!sameValue(track.to, target)) {
        if (!isTransform && !interpolatable([track.to, target as any])) {
          // sem interpolação possível (ex.: 'auto' → 100): troca na hora, com um aviso
          warnUnsupportedTransition(key);
        }
        track.from = currentValue(track, track.last);
        track.to = target;
        track.timing = timing;
        track.node = undefined;
        // o progresso anterior segue intacto (ainda está na view montada) e para depois do commit
        track.retired.push(track.progress);
        freshProgress(track, 0);
        track.pending = true;
      }

      track.node ??= buildNode(track);
      animated[key] = track.node;
    }

    // as animações começam depois do commit (efeito), não durante a renderização. `pending` fica no
    // track (e não numa lista do render) para valer mesmo quando o React renderiza duas vezes e só
    // comita a segunda (StrictMode, render concorrente).
    useEffect(() => {
      store.forEach((track) => {
        track.retired.forEach(retire);
        track.retired = [];
        if (!track.pending) return;
        track.pending = false;
        Animated.timing(track.progress, {
          toValue: 1,
          duration: track.timing.duration,
          delay: track.timing.delay,
          easing: track.timing.easing,
          useNativeDriver: spec.nativeDriver,
          isInteraction: false,
        }).start();
      });
    });

    useEffect(
      () => () => {
        store.forEach((t) => {
          retire(t.progress);
          t.retired.forEach(retire);
        });
      },
      [store],
    );

    // o componente do RN precisa ser animado para aceitar nós `Animated` no estilo
    return React.createElement(AnimatedFor(Component), { ...rest, ref, style: animated });
  });

  Created.displayName = `Transition(${(Component as any).displayName || (Component as any).name || 'Component'})`;
  Host = Created;
  hosts.set(Component, Host);
  return Host;
}

const animatedComponents = new WeakMap<React.ComponentType<any>, any>();
function AnimatedFor(Component: React.ComponentType<any>): any {
  let A = animatedComponents.get(Component);
  if (!A) {
    A = Animated.createAnimatedComponent(Component as any);
    animatedComponents.set(Component, A);
  }
  return A;
}
