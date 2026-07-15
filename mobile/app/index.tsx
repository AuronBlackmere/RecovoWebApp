import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '@/utils/theme';

export default function IndexScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={COLORS.accent} size="large" />
    </View>
  );
}
