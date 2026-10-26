import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useTheme } from '../../theme/ThemeProvider';
import type { Palette } from '../../theme/theme';

/** One icon family (Ionicons) across the app: outline for UI, filled only for active states. */
export type IconName = ComponentProps<typeof Ionicons>['name'];

export const iconSize = { small: 16, medium: 20, large: 24 } as const;

export function Icon({
  name,
  size = 'medium',
  color,
  tone = 'textSecondary',
}: {
  name: IconName;
  size?: keyof typeof iconSize | number;
  color?: string;
  tone?: keyof Palette;
}) {
  const { colors } = useTheme();
  return (
    <Ionicons
      name={name}
      size={typeof size === 'number' ? size : iconSize[size]}
      color={color ?? colors[tone]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

export function preloadIcons() {
  void Ionicons.loadFont().catch(() => undefined);
}
