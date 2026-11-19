// 頁面內對話框（SPEC 12：不使用 alert / confirm / prompt）
import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';

export function Dialog(props: { title: string; onClose: () => void; children: ComponentChildren }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [props.onClose]);
  return (
    <div class="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class="dialog" role="dialog" aria-modal="true" aria-label={props.title}>
        <div class="dialog-head">
          <h2>{props.title}</h2>
          <button type="button" class="icon-btn" aria-label="關閉" onClick={props.onClose}>
            ✕
          </button>
        </div>
        <div class="dialog-body">{props.children}</div>
      </div>
    </div>
  );
}
