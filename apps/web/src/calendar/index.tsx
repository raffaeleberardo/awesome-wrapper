import { copy } from '@git-wrapped/copy';
import type { CalendarUploadProps } from '../shared/types';

/** Caricamento isolato, servito su `#/dev/calendar` per sviluppo e test (mostra le stats calcolate). */
export function CalendarDemo() {
  return <p>CalendarDemo: stub di A0</p>;
}

/** Caricamento del calendario .ics (A8). Stub di A0: firma congelata. */
export function CalendarUpload({ onSkip }: CalendarUploadProps) {
  return (
    <section>
      <h2>{copy.ui.calendar_upload_title}</h2>
      <button type="button" onClick={onSkip}>
        {copy.ui.calendar_skip}
      </button>
    </section>
  );
}
