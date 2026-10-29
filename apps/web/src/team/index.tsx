import { copy } from '@git-wrapped/copy';
import type { MemberPickerProps, OscarNightProps } from '../shared/types';

/** Scelta del membro e Notte degli Oscar (A7). Stub di A0: firme congelate. */

export function MemberPicker({ members, onPick, onOpenOscar }: MemberPickerProps) {
  return (
    <main>
      <h1>{copy.ui.pick_member}</h1>
      <ul>
        {members.map((m) => (
          <li key={m.username}>
            <button type="button" onClick={() => onPick(m)}>
              {m.displayName}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onOpenOscar}>
        {copy.ui.oscar_cta}
      </button>
    </main>
  );
}

export function OscarNight({ awards, onBack }: OscarNightProps) {
  return (
    <main>
      <h1>{copy.ui.oscar_title}</h1>
      <p>{awards.awards.length}</p>
      <button type="button" onClick={onBack}>
        {copy.ui.close}
      </button>
    </main>
  );
}
