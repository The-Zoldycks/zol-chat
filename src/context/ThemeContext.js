import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, darkTheme, lightTheme } from '../theme/theme';
import { useEffect } from 'react';

const ThemeContext = createContext();

const THEME_KEY = 'app_theme_mode';

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === 'light') setIsDark(false);
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      return next;
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  }, [isDark]);

  const value = useMemo(() => ({
    isDark,
    toggleTheme,
    colors: isDark ? darkColors : lightColors,
    paperTheme: isDark ? darkTheme : lightTheme,
  }), [isDark, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
