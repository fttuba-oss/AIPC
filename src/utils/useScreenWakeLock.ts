import { useEffect } from 'react';
import { keepScreenAwake } from './screenWakeLock';

export function useScreenWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return keepScreenAwake({
      request: navigator.wakeLock ? () => navigator.wakeLock.request('screen') : undefined,
      visible: () => document.visibilityState === 'visible',
      listen: callback => {
        document.addEventListener('visibilitychange', callback);
        window.addEventListener('focus', callback);
        window.addEventListener('pageshow', callback);
        return () => {
          document.removeEventListener('visibilitychange', callback);
          window.removeEventListener('focus', callback);
          window.removeEventListener('pageshow', callback);
        };
      },
    });
  }, [active]);
}
