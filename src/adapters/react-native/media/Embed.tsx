/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import React, { forwardRef } from 'react';
import type { EmbedOwnProps } from '../../../core/media';
import { MissingModule } from './MissingModule';

declare const require: (id: string) => any;

/** `require` dentro de `try/catch`: dependência OPCIONAL para o Metro (veja `Video.tsx`). */
let cached: any;
function webView(): any {
  if (cached === undefined) {
    try {
      cached = require('react-native-webview').WebView;
    } catch {
      cached = null;
    }
  }
  return cached;
}

export const Embed = forwardRef<any, EmbedOwnProps & { style?: any; testID?: string }>(
  ({ src, html, title, onLoad, onError, style, testID }, ref) => {
    const WebView = webView();
    if (!WebView) return <MissingModule primitive="Embed" pkg="react-native-webview" style={style} />;
    return (
      <WebView
        ref={ref}
        testID={testID}
        accessibilityLabel={title}
        source={html !== undefined ? { html } : { uri: src }}
        style={[{ minHeight: 240 }, style]}
        onLoadEnd={() => onLoad?.()}
        onError={(event: any) => onError?.(event?.nativeEvent?.description ?? 'Falha ao carregar o conteúdo.')}
      />
    );
  },
);
Embed.displayName = 'Embed';
