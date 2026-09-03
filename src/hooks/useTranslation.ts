import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import {
  loadTranslations,
  t,
  onTranslationsChanged,
} from '../services/uiTranslation';

/**
 * Hook that provides the t() translation function.
 * Automatically loads translations when language changes.
 * Re-renders when translations finish loading via global event.
 * Pass all UI strings that need translation.
 */
export function useTranslation(strings: string[]) {
  const language = useAppStore(s => s.language);
  const [, setTick] = useState(0);

  const uniqueStrings = [...new Set(strings.filter(s => s.trim()))];

  // Always load translations when component mounts or language/strings change
  useEffect(() => {
    loadTranslations(language, uniqueStrings);
  }, [language, uniqueStrings.join('|||')]);

  // Subscribe to global translation change event
  useEffect(() => {
    const unsub = onTranslationsChanged(() => {
      setTick(tick => tick + 1); // Force re-render
    });
    return unsub;
  }, []);

  const translate = useCallback((key: string): string => {
    return t(key);
  }, [language]);

  return { t: translate, language };
}
