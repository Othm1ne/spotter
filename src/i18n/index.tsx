import { getLocales } from 'expo-localization';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nManager } from 'react-native';

import { getSetting, setSetting } from '@/db/settings';

import de from './de';
import en from './en';
import es from './es';
import fr from './fr';

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
] as const;

export type Lang = (typeof LANGUAGES)[number]['code'];
/** What the user picked in Settings; "system" follows the phone. */
export type LanguageChoice = Lang | 'system';

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Every translation key, e.g. "home.kcalLeft". */
export type TKey = Leaves<typeof en>;
export type Params = Record<string, string | number>;

/** A translation file: same shape as English, every string present. */
export type Dict = { [K in keyof typeof en]: DeepStrings<(typeof en)[K]> };
type DeepStrings<T> = T extends string ? string : { [K in keyof T]: DeepStrings<T[K]> };

const DICTS: Record<Lang, Dict> = { en, fr, es, de };

/** English names of the languages, for telling the AI which one to answer in. */
const AI_NAMES: Record<Lang, string> = { en: 'English', fr: 'French', es: 'Spanish', de: 'German' };

function lookup(dict: Dict, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Translates `key`, filling {placeholders} from `params`. With a `count` param, "key_one" is used
 * for 1 when it exists. Falls back to English, then to the key itself.
 */
export function translate(lang: Lang, key: TKey | string, params?: Params): string {
  const count = params?.count;
  const candidates = count === 1 ? [`${key}_one`, key] : [key];
  let text: string | undefined;
  for (const k of candidates) {
    text = lookup(DICTS[lang], k) ?? lookup(DICTS.en, k);
    if (text !== undefined) break;
  }
  if (text === undefined) return key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (params[name] !== undefined ? String(params[name]) : m));
}

/** Whether `key` exists (in English, the reference language). */
export function hasTranslation(key: string): boolean {
  return lookup(DICTS.en, key) !== undefined;
}

export function deviceLanguage(): Lang {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return (LANGUAGES.some((l) => l.code === code) ? code : 'en') as Lang;
}

// Code outside React (notifications, AI prompts, saved hints) reads the current language here.
let current: Lang = deviceLanguage();

export function currentLanguage(): Lang {
  return current;
}

/** Translate outside React components, in the language currently shown. */
export function t(key: TKey | string, params?: Params): string {
  return translate(current, key, params);
}

/** The language name in English, for AI prompts: "Answer in French". */
export function aiLanguageName(lang: Lang = current): string {
  return AI_NAMES[lang];
}

type I18n = {
  lang: Lang;
  choice: LanguageChoice;
  /** BCP-47 tag for dates and numbers. */
  locale: string;
  t: (key: TKey | string, params?: Params) => string;
  setLanguage: (choice: LanguageChoice) => void;
};

const I18nContext = createContext<I18n>({
  lang: current,
  choice: 'system',
  locale: current,
  t: (key, params) => translate(current, key, params),
  setLanguage: () => {},
});

// Every language reads left to right. An earlier build could switch the layout to right-to-left,
// and that setting is stored by the app shell: turn it back off (it applies from the next launch).
if (I18nManager.isRTL) {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [choice, setChoice] = useState<LanguageChoice>('system');

  useEffect(() => {
    getSetting(db, 'language').then((v) => {
      if (v && (v === 'system' || LANGUAGES.some((l) => l.code === v))) setChoice(v as LanguageChoice);
    });
  }, [db]);

  const lang: Lang = choice === 'system' ? deviceLanguage() : choice;

  useEffect(() => {
    current = lang;
  }, [lang]);

  const setLanguage = useCallback(
    (next: LanguageChoice) => {
      setChoice(next);
      setSetting(db, 'language', next);
    },
    [db]
  );

  const value = useMemo<I18n>(
    () => ({ lang, choice, locale: lang, t: (key, params) => translate(lang, key, params), setLanguage }),
    [lang, choice, setLanguage]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

/** The translate function for the current language. */
export function useT() {
  return useContext(I18nContext).t;
}
