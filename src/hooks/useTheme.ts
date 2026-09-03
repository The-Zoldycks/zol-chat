import { useThemeContext } from '../contexts/ThemeContext';
import { getColors, type ThemeColors } from '../config/theme';

export { getColors, type ThemeColors };

export function useThemeColors() {
  const { colors } = useThemeContext();
  return colors;
}
