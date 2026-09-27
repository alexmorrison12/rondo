/**
 * Tiny persisted, observable store. Values live in localStorage under `rondo:<key>`,
 * are versioned (a version bump discards stale shapes), and stay in sync across tabs.
 */
type Listener<T> = (value: T) => void;

export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(fn: Listener<T>, immediate?: boolean): () => void;
}

const PREFIX = 'rondo:';

function safeRead<T>(key: string, version: number): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v: number; d: T };
    return parsed.v === version ? parsed.d : null;
  } catch {
    return null;
  }
}

function safeWrite<T>(key: string, version: number, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ v: version, d: value }));
  } catch {
    /* storage full or blocked: the in-memory value still works for this page */
  }
}

export function persisted<T>(key: string, initial: T, version = 1): Store<T> {
  let value: T = safeRead<T>(key, version) ?? initial;
  const listeners = new Set<Listener<T>>();
  const emit = () => listeners.forEach((l) => l(value));

  window.addEventListener('storage', (event) => {
    if (event.key !== PREFIX + key) return;
    value = safeRead<T>(key, version) ?? initial;
    emit();
  });

  return {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
      safeWrite(key, version, value);
      emit();
    },
    subscribe(fn, immediate = true) {
      listeners.add(fn);
      if (immediate) fn(value);
      return () => listeners.delete(fn);
    },
  };
}

/** Session-only memory (e.g. last order), same API. */
export function sessionValue<T>(key: string): { get(): T | null; set(v: T): void } {
  return {
    get() {
      try {
        const raw = sessionStorage.getItem(PREFIX + key);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    },
    set(v) {
      try {
        sessionStorage.setItem(PREFIX + key, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    },
  };
}
