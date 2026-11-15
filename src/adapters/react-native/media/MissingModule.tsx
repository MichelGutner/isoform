import React from 'react';
import { Text, View } from 'react-native';
import { warnOnce } from '../../../core/dev';

/**
 * Mostrado no lugar da primitiva quando a dependência nativa opcional não está
 * instalada: o app continua de pé e a mensagem diz exatamente o que fazer.
 */
export function MissingModule({ primitive, pkg, style }: { primitive: string; pkg: string; style?: unknown }) {
  const message = `${primitive} precisa de "${pkg}". Instale com: npx expo install ${pkg}`;
  warnOnce(`media-missing:${pkg}`, message);
  return (
    <View style={[{ padding: 12, backgroundColor: '#fff3cd', justifyContent: 'center' }, style as any]}>
      <Text style={{ color: '#664d03', fontSize: 12 }}>{message}</Text>
    </View>
  );
}
