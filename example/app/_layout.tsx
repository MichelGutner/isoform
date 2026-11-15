import { Stack } from 'expo-router';
// The SAME config as the web app (provider 'auto': here Metro loads the React Native adapter).
import '../../examples/showcase/omni.config';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
