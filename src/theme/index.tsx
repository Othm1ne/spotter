import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { getSetting, setSetting } from '@/db/settings';

import { dark, light, type Palette } from './palettes';

export type { Palette } from './palettes';

/** What the user picked in Settings; "system" follows the phone. */
export type Appearance = 'system' | 'light' | 'dark';

type Theme = { colors: Palette; appearance: Appearance; setAppearance: (a: Appearance) => void };

const ThemeContext = createContext<Theme>({ colors: dark, appearance: 'system', setAppearance: () => {} });

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const system = useColorScheme();
  const [appearance, setState] = useState<Appearance>('system');

  useEffect(() => {
    getSetting(db, 'appearance').then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setState(v);
    });
  }, [db]);

  const setAppearance = useCallback(
    (a: Appearance) => {
      setState(a);
      setSetting(db, 'appearance', a);
    },
    [db]
  );

  const scheme = appearance === 'system' ? (system ?? 'dark') : appearance;
  const value = useMemo(
    () => ({ colors: scheme === 'light' ? light : dark, appearance, setAppearance }),
    [scheme, appearance, setAppearance]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** The current palette. */
export function useColors(): Palette {
  return useContext(ThemeContext).colors;
}

/**
 * Like StyleSheet.create, but the styles can use the current palette. Returns a hook; styles are
 * built once per palette and shared by every component that uses them.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(build: (c: Palette) => T) {
  const cache = new Map<Palette, T>();
  return function useStyles(): T {
    const colors = useColors();
    let styles = cache.get(colors);
    if (!styles) {
      styles = StyleSheet.create(build(colors));
      cache.set(colors, styles);
    }
    return styles;
  };
}
