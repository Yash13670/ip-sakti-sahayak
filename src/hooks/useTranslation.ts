import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store';
import {
  loadTranslations,
  t,
  onTranslationsChanged,
} from '../services/uiTranslation';

/**
 * Hook that provides the t() translation function.
 * Automatically loads translations on mount and when language changes.
 * Shows loading state while translations are being fetched.
 */
export function useTranslation(strings: string[]) {
  const language = useAppStore(s => s.language);
  const [ready, setReady] = useState(language === 'en');
  const [, setTick] = useState(0);
  const mountedRef = useRef(true);

  const uniqueStrings = [...new Set(strings.filter(s => s.trim()))];

  useEffect(() => {
    mountedRef.current = true;

    if (language === 'en') {
      setReady(true);
      return;
    }

    setReady(false);
    loadTranslations(language, uniqueStrings).then(() => {
      if (mountedRef.current) setReady(true);
    });

    return () => { mountedRef.current = false; };
  }, [language, uniqueStrings.join('|||')]);

  // Subscribe to global translation change event
  useEffect(() => {
    const unsub = onTranslationsChanged(() => {
      setTick(tick => tick + 1);
      setReady(true);
    });
    return unsub;
  }, []);

  const translate = useCallback((key: string): string => {
    return t(key);
  }, [ready, language]);

  return { t: translate, language, ready };
}
