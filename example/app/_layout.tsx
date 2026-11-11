import { Stack } from 'expo-router';
// A MESMA config do app web (provider 'auto': aqui o Metro carrega o adapter React Native).
import '../../examples/shared-ui/omni.config';
import { applyTheme } from '../theme/presets';

export const unstable_settings = {
  anchor: 'index',
};

// Tema inicial (a tela de testes altera em tempo de execução).
applyTheme('light', 'indigo', 'comfortable');

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="universal" options={{ title: 'Universal (shared-ui)' }} />
    </Stack>
  );
}
