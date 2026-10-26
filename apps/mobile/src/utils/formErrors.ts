import { useCallback, useState } from 'react';

type Issue = { path: readonly PropertyKey[]; message: string };

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

/** Maps schema issues to the first message per top-level field. */
export function issuesToFieldErrors<K extends string>(issues: readonly Issue[]): FieldErrors<K> {
  const errors: FieldErrors<K> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in errors)) {
      errors[key as K] = issue.message;
    }
  }
  return errors;
}

export function useFieldErrors<K extends string>() {
  const [errors, setErrors] = useState<FieldErrors<K>>({});

  const clear = useCallback((key: K) => {
    setErrors((current) => {
      if (!(key in current)) {
        return current;
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  return { errors, setErrors, clear };
}
