import { copy } from './copy';
import type { SavedPreference } from './preferenceStore';

type Props = {
  result: SavedPreference;
  onEdit: () => void;
  onBack: () => void;
};

export function PreferencesResult({ result, onEdit, onBack }: Props) {
  return (
    <section>
      <h1 tabIndex={-1} data-screen-heading>
        {result.title}
      </h1>
      <p>{result.description}</p>
      <button type="button" onClick={onEdit}>
        {copy.editSettings}
      </button>
      <button type="button" onClick={onBack}>
        {copy.backToList}
      </button>
    </section>
  );
}
