import { useId, useState } from 'react';
import { copy } from './copy';
import {
  readPreference,
  updatePreference,
  type PreferenceId,
  type SavedPreference,
} from './preferenceStore';

type Props = {
  id: PreferenceId;
  onSaved: (result: SavedPreference) => void;
  onCancel: () => void;
};

export function PreferenceCard({ id, onSaved, onCancel }: Props) {
  const controlId = useId();
  const [enabled, setEnabled] = useState(() => readPreference(id));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const result = await updatePreference(id, enabled);
    onSaved(result);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label htmlFor={controlId}>
        <input
          id={controlId}
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        {copy.keepConnection}
      </label>
      <p>{enabled ? copy.enabled : copy.disabled}</p>
      <button type="submit" disabled={saving}>
        {saving ? copy.saving : copy.save}
      </button>
      <button type="button" disabled={saving} onClick={onCancel}>
        {copy.cancel}
      </button>
    </form>
  );
}
