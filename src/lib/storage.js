import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export const BUCKET = 'hapmore';
const TTL_SECONDS = 60 * 60 * 6;
const cache = new Map(); // path -> { url, exp }

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id || null;
}

export function peekSignedUrl(path) {
  if (!path) return null;
  const c = cache.get(path);
  return c && c.exp > Date.now() ? c.url : null;
}

function remember(path, url) {
  cache.set(path, { url, exp: Date.now() + (TTL_SECONDS - 900) * 1000 });
}

export async function getSignedUrl(path) {
  if (!path) return null;
  const cached = peekSignedUrl(path);
  if (cached) return cached;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, TTL_SECONDS);
  if (error) {
    console.error('Signed URL failed', path, error);
    return null;
  }
  remember(path, data.signedUrl);
  return data.signedUrl;
}

export async function getSignedUrls(paths) {
  const out = {};
  const need = [];
  paths.forEach((p) => {
    const c = peekSignedUrl(p);
    if (c) out[p] = c;
    else if (p) need.push(p);
  });
  if (need.length) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(need, TTL_SECONDS);
    if (error) console.error('Signed URLs failed', error);
    (data || []).forEach((d) => {
      if (d.signedUrl && d.path) {
        out[d.path] = d.signedUrl;
        remember(d.path, d.signedUrl);
      }
    });
  }
  return out;
}

/** Uploads into the private bucket under <user-id>/<folder>/<uuid>.<ext>. Returns the storage path. */
export async function uploadFile(file, folder = 'images', { maxMB = 10 } = {}) {
  const uid = await currentUserId();
  if (!uid) throw new Error('You are not signed in.');
  if (file.size > maxMB * 1024 * 1024) throw new Error(`File is larger than ${maxMB} MB.`);
  const fromName = file.name && file.name.includes('.') ? file.name.split('.').pop() : '';
  const ext = (fromName || (file.type || 'image/png').split('/')[1] || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${uid}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
    cacheControl: '3600',
  });
  if (error) throw error;
  return path;
}

export async function removeFile(path) {
  if (!path) return;
  cache.delete(path);
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.error('Remove failed', error);
}

export function pickFile(accept = 'image/*') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files && input.files[0] ? input.files[0] : null);
    input.click();
  });
}

/** React hook: resolves a private storage path to a (cached) signed URL. */
export function useSignedUrl(path) {
  const [url, setUrl] = useState(() => peekSignedUrl(path));
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(null);
      return undefined;
    }
    const cached = peekSignedUrl(path);
    if (cached) {
      setUrl(cached);
      return undefined;
    }
    getSignedUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}
