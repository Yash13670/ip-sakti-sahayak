import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import {
  registerStrings,
  switchLanguage,
  getTranslationVersion,
  t,
} from '../services/uiTranslation';

/**
 * Translation hook — shared store, all components read from same source.
 *
 * When language changes:
 * 1. switchLanguage() clears old translations, loads new cache
 * 2. registerStrings() fetches missing translations from API
 * 3. All components see the same translations at the same time
 */
export function useTranslation(strings: string[]) {
  const language = useAppStore(s => s.language);
  const [ver, setVer] = useState(getTranslationVersion());

  const uniqueStrings = [...new Set(strings.filter(s => s.trim()))];
  const stringsKey = uniqueStrings.join('|||');

  useEffect(() => {
    if (language === 'en') {
      switchLanguage('en').then(() => setVer(getTranslationVersion()));
      return;
    }

    // Step 1: Switch language (clears old, loads cache)
    switchLanguage(language).then(() => {
      setVer(getTranslationVersion());

      // Step 2: Register this component's strings (fetches missing from API)
      registerStrings(language, uniqueStrings).then(() => {
        setVer(getTranslationVersion());
      });
    });
  }, [language, stringsKey]);

  const translate = useCallback((key: string): string => {
    return t(key);
  }, [ver, language]);

  return { t: translate, language, ready: true };
}
