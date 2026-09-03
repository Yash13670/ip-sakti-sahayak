import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store';
import { loadTranslations, t } from '../services/uiTranslation';

/**
 * Translation hook — guaranteed re-render via Zustand store.
 *
 * How it works:
 * 1. On mount, loads translations for current language
 * 2. Uses a Zustand version counter to force re-renders
 * 3. Falls back to English text while loading
 */
export function useTranslation(strings: string[]) {
  const language = useAppStore(s => s.language);
  const [tick, setTick] = useState(0);
  const mountedRef = useRef(true);

  const uniqueStrings = [...new Set(strings.filter(s => s.trim()))];
  const stringsKey = uniqueStrings.join('|||');

  useEffect(() => {
    mountedRef.current = true;

    if (language === 'en') {
      setTick(t => t + 1);
      return;
    }

    loadTranslations(language, uniqueStrings).then(() => {
      if (mountedRef.current) {
        setTick(t => t + 1); // Force re-render after translations load
      }
    });

    return () => { mountedRef.current = false; };
  }, [language, stringsKey]);

  // translate function uses latest translations via closure
  const translate = useCallback((key: string): string => {
    return t(key);
  }, [tick, language]);

  return { t: translate, language, ready: language === 'en' || tick > 0 };
}
