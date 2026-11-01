import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../store/useApp';

const META_KEYS = ['title', 'subtitle', 'icon', 'tags', 'type'];

/** Batches note patches and writes them to Supabase after `delay` ms of quiet. Flushes on unmount / page hide. */
export function useNoteSaver(noteId, delay = 700) {
  const pending = useRef({});
  const timer = useRef(null);
  const idRef = useRef(noteId);
  const [status, setStatus] = useState('saved'); // saved | dirty | saving | error

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    timer.current = null;
    const id = idRef.current;
    const patch = pending.current;
    pending.current = {};
    if (!id || !Object.keys(patch).length) return;
    setStatus('saving');
    const { data, error } = await supabase.from('notes').update(patch).eq('id', id).select('updated_at').maybeSingle();
    if (error) {
      // Put it back so the next change retries.
      pending.current = { ...patch, ...pending.current };
      setStatus('error');
      useApp.getState().fail(error, 'Could not save note');
      return;
    }
    if (data?.updated_at) useApp.getState().patchNoteMeta(id, { updated_at: data.updated_at });
    setStatus(Object.keys(pending.current).length ? 'dirty' : 'saved');
  }, []);

  const save = useCallback(
    (patch) => {
      pending.current = { ...pending.current, ...patch };
      const meta = {};
      META_KEYS.forEach((k) => k in patch && (meta[k] = patch[k]));
      if (Object.keys(meta).length) useApp.getState().patchNoteMeta(idRef.current, meta);
      setStatus('dirty');
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [flush, delay],
  );

  useEffect(() => {
    idRef.current = noteId;
    return () => {
      flush();
    };
  }, [noteId, flush]);

  useEffect(() => {
    const onHide = () => flush();
    const onVis = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [flush]);

  return { save, flush, status };
}
