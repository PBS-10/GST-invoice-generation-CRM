import { useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const useNativeDriver = Platform.OS !== 'web';

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  /** 1 disables the scale effect (e.g. for full-width list rows). */
  scaleTo?: number;
  children?: ReactNode;
};

/**
 * Base press primitive: a quick, un-bouncy scale plus an optional pressed style.
 * Respects the system "reduce motion" setting.
 */
export function PressableScale({
  style,
  pressedStyle,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...rest
}: PressableScaleProps) {
  const { reducedMotion } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const animateScale = !reducedMotion && scaleTo !== 1;

  function animateTo(value: number) {
    if (!animateScale) {
      return;
    }
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver,
      speed: 48,
      bounciness: 0,
    }).start();
  }

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(event: GestureResponderEvent) => {
        setPressed(true);
        animateTo(scaleTo);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        setPressed(false);
        animateTo(1);
        onPressOut?.(event);
      }}
      style={[style, pressed && pressedStyle, animateScale && { transform: [{ scale }] }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
