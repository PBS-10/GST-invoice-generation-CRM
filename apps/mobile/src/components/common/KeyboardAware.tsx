import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { useSmoothKeyboard } from '../../hooks/useSmoothKeyboard';

/**
 * Lifts its children above the software keyboard.
 * Uses a plain View + numeric inset (not Animated layout props) so Fabric
 * does not break FlatList / list screens on Android.
 */
export function KeyboardAware({
  children,
  style,
  enabled = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  enabled?: boolean;
}) {
  const { keyboardHeight } = useSmoothKeyboard(enabled);
  return (
    <View style={[{ flex: 1 }, style, { paddingBottom: keyboardHeight }]}>
      {children}
    </View>
  );
}
