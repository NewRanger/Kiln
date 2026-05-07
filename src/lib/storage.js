import { useEffect, useRef, useState } from 'react';
import { getDefaultState } from './defaults.js';
import { migrate } from './migrations.js';

const SAVE_DEBOUNCE_MS = 400;

export function useAppState() {
  const [state, setState] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved');
  const skipNextSaveRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await window.kiln.load();
        if (cancelled) return;
        setState(migrate(loaded));
      } catch (err) {
        console.error('Failed to load state', err);
        if (!cancelled) setState(getDefaultState());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state == null) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    setSaveStatus('saving');
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        await window.kiln.save(state);
        if (!cancelled) setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save state', err);
        if (!cancelled) setSaveStatus('error');
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state]);

  return [state, setState, saveStatus];
}
