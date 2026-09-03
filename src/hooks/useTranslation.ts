import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store';
import {
  loadTranslations,
  loadCachedTranslations,
  getTranslationVersion,
  t,
} from '../services/uiTranslation';

/**
 * Translation hook — sync cache load + async API fetch.
 *
 * Flow:
 * 1. On mount: synchronously load cached translations → UI shows correct language immediately
 * 2. Then: async fetch missing translations from API → update cache → bump version → re-render
 */
export function useTranslation(strings: string[]) {
  const language = useAppStore(s => s.language);
  const [version, setVersion] = useState(getTranslationVersion());
  const mountedRef = useRef(true);
  const prevLang = useRef(language);

  const uniqueStrings = [...new Set(strings.filter(s => s.trim()))];
  const stringsKey = uniqueStrings.join('|||');

  // 1. Synchronous cache load on mount or language change
  useEffect(() => {
    mountedRef.current = true;

    if (language === 'en') {
      loadCachedTranslations('en');
      setVersion(v => v + 1);
      prevLang.current = language;
      return;
    }

    // Immediately load from cache — UI updates instantly
    loadCachedTranslations(language);
    setVersion(v => v + 1);
    prevLang.current = language;

    // 2. Async: fetch missing translations from API
    loadTranslations(language, uniqueStrings).then(() => {
      if (mountedRef.current) {
        setVersion(getTranslationVersion());
      }
    });

    return () => { mountedRef.current = false; };
  }, [language, stringsKey]);

  const translate = useCallback((key: string): string => {
    return t(key);
  }, [version, language]);

  return { t: translate, language, ready: true };
}
