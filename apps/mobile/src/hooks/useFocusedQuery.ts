import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { errorMessage } from '../utils/errors';
import { logger } from '../utils/logger';

export type QueryState<T> =
  | { status: 'loading'; data: undefined; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: T | undefined; error: string };

/**
 * Loads data whenever the screen gains focus. Previously loaded data stays on
 * screen while refreshing, so returning to a screen never flashes a skeleton.
 * `load` must be memoised by the caller.
 */
export function useFocusedQuery<T>(load: () => Promise<T>) {
  const [state, setState] = useState<QueryState<T>>({
    status: 'loading',
    data: undefined,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load().then(
        (data) => {
          if (active) {
            setState({ status: 'ready', data, error: null });
          }
        },
        (error: unknown) => {
          logger.error('screen_load_failed', { message: errorMessage(error) });
          if (active) {
            setState((current) => ({
              status: 'error',
              data: current.data,
              error: errorMessage(error),
            }));
          }
        },
      );
      return () => {
        active = false;
      };
      // `attempt` is a dependency only so that `reload` re-runs the effect.
    }, [load, attempt]),
  );

  const reload = useCallback(() => {
    setState((current) =>
      current.data === undefined
        ? { status: 'loading', data: undefined, error: null }
        : current,
    );
    setAttempt((value) => value + 1);
  }, []);

  return { ...state, reload };
}
