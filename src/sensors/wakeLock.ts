// 螢幕常亮（SPEC 3.3）。頁面切到背景時系統會自動釋放，回到前景再重新取得。
import { useEffect } from 'preact/hooks';

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || lock) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => {
          lock = null;
        });
        if (cancelled) void lock.release();
      } catch {
        // 省電模式等情況可能被拒絕，不影響其他功能
      }
    };
    const onVis = () => void acquire();
    void acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release();
    };
  }, [active]);
}
