export interface ScreenLock {
  released?: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', callback: () => void): void;
}
export interface WakeLockEnvironment {
  request?: () => Promise<ScreenLock>;
  visible: () => boolean;
  listen: (callback: () => void) => () => void;
}

/** One lock per active playback lifetime. Failures must never interrupt music. */
export function keepScreenAwake(environment: WakeLockEnvironment): () => void {
  if (!environment.request) return () => {};
  let disposed = false, pending = false;
  let lock: ScreenLock | null = null;
  const release = () => {
    const held = lock; lock = null;
    if (held) void held.release().catch(() => {});
  };
  const acquire = async () => {
    if (disposed) return;
    if (!environment.visible()) { release(); return; }
    if (pending || (lock && !lock.released)) return;
    pending = true;
    try {
      const acquired = await environment.request!();
      if (disposed || !environment.visible()) { await acquired.release(); return; }
      lock = acquired;
      acquired.addEventListener('release', () => { if (lock === acquired) lock = null; });
    } catch { /* Browser policy, low battery and unsupported contexts may refuse a lock. */ }
    finally { pending = false; }
  };
  const unlisten = environment.listen(() => { void acquire(); });
  void acquire();
  return () => { disposed = true; unlisten(); release(); };
}
