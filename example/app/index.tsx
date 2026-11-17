import { StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'isoform';
import { Showcase } from '../../examples/showcase';

/** The same showcase that runs on the web (example-web): no platform-specific code besides the safe area. */
export default function HomeScreen() {
  const { top } = useSafeAreaInsets();
  const theme = useTheme();
  return (
    <View style={{ flex: 1, paddingTop: top, backgroundColor: theme.color.background }}>
      <StatusBar barStyle="default" />
      <Showcase />
    </View>
  );
}
