import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, darkTheme, lightTheme } from '../theme/theme';
import { useEffect } from 'react';

const ThemeContext = createContext();

const THEME_KEY = 'app_theme_mode';
const FONT_SIZE_KEY = 'app_font_scale';

export const FONT_SCALES = [
  { label: 'S', value: 0.85 },
  { label: 'M', value: 1.0 },
  { label: 'L', value: 1.15 },
  { label: 'XL', value: 1.3 },
];

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);
  const [fontScale, setFontScale] = useState(1.0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(THEME_KEY),
      AsyncStorage.getItem(FONT_SIZE_KEY),
    ]).then(([themeVal, fontVal]) => {
      if (themeVal === 'light') setIsDark(false);
      if (fontVal != null) {
        const num = parseFloat(fontVal);
        if (!isNaN(num)) setFontScale(num);
      }
      setLoaded(true);
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  const updateFontScale = useCallback((value) => {
    setFontScale(value);
    AsyncStorage.setItem(FONT_SIZE_KEY, String(value));
  }, []);

  const scaleFont = useCallback((base) => Math.round(base * fontScale), [fontScale]);

  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    }
  }, [isDark, loaded]);

  const value = useMemo(() => ({
    isDark,
    toggleTheme,
    colors: isDark ? darkColors : lightColors,
    paperTheme: isDark ? darkTheme : lightTheme,
    fontScale,
    updateFontScale,
    scaleFont,
  }), [isDark, toggleTheme, fontScale, updateFontScale, scaleFont]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
