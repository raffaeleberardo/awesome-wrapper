import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { toPng } from 'html-to-image';
import { copy } from '@git-wrapped/copy';
import type { CardExportButtonProps, ThemeName } from '../shared/types';
import { THEMES } from '../theme';

export const EXPORT_WIDTH = 1080;
export const EXPORT_HEIGHT = 1920;

interface PngButtonProps {
  /** Contenuto 9:16 da esportare (viene reso in un contenitore 1080×1920). */
  render: () => ReactNode;
  theme: ThemeName;
  fileName: string;
  label?: string;
}

type Status = 'idle' | 'loading' | 'error';

/** Bottone che renderizza `render()` fuori schermo a 1080×1920, lo converte in PNG e lo scarica. */
export function PngExportButton({ render, theme, fileName, label }: PngButtonProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [mounted, setMounted] = useState(false);
  const t = THEMES[theme];

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    void (async () => {
      try {
        // Aspetta il disegno dell'albero fuori schermo e il caricamento dei font.
        await new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r())),
        );
        await document.fonts.ready;
        if (cancelled) return;
        const node = document.getElementById(`png-export-${fileName}`);
        if (!node) throw new Error('export target missing');
        const dataUrl = await toPng(node, {
          width: EXPORT_WIDTH,
          height: EXPORT_HEIGHT,
          pixelRatio: 1,
        });
        if (cancelled) return;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${fileName}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setStatus('idle');
        setMounted(false);
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMounted(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, fileName]);

  return (
    <>
      <button
        type="button"
        data-testid="export-button"
        data-status={status}
        aria-busy={status === 'loading'}
        disabled={status === 'loading'}
        onClick={() => {
          setStatus('loading');
          setMounted(true);
        }}
        style={{
          font: 'inherit',
          fontWeight: 700,
          padding: '0.55em 1.1em',
          borderRadius: '999px',
          border: 0,
          cursor: status === 'loading' ? 'progress' : 'pointer',
          background: '#fff',
          color: '#111',
        }}
      >
        {label ?? copy.ui.download_png}
        {status === 'loading' ? ' …' : ''}
      </button>
      {status === 'error' ? (
        <span role="alert" style={{ marginLeft: 8, fontSize: 14 }}>
          {copy.ui.error_generic}
        </span>
      ) : null}
      {mounted
        ? createPortal(
            <div
              aria-hidden="true"
              style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }}
            >
              <div
                id={`png-export-${fileName}`}
                style={{
                  width: EXPORT_WIDTH,
                  height: EXPORT_HEIGHT,
                  background: t.background,
                  color: t.foreground,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {render()}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Bottone "scarica PNG" di una card della storia. */
export function CardExportButton({ card, fileName }: CardExportButtonProps) {
  return (
    <PngExportButton
      theme={card.theme}
      fileName={fileName}
      render={() => card.render({ exporting: true })}
    />
  );
}
