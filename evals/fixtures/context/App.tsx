import { useEffect, useRef, useState } from 'react';
import { copy } from './copy';
import { flows, type PreferenceFlow } from './flows';
import { PreferenceCard } from './PreferenceCard';
import { PreferencesResult } from './PreferencesResult';
import { readPreference, type SavedPreference } from './preferenceStore';

type Screen =
  | { kind: 'list' }
  | { kind: 'settings'; flow: PreferenceFlow }
  | { kind: 'result'; flow: PreferenceFlow; result: SavedPreference };

// These seven files contain the complete UI and state boundary of this fixture.
export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'list' });
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current
      ?.querySelector<HTMLElement>('[data-screen-heading]')
      ?.focus();
  }, [screen]);

  return (
    <main ref={mainRef}>
      {screen.kind === 'list' && (
        <>
          <h1 tabIndex={-1} data-screen-heading>
            {copy.appTitle}
          </h1>
          {flows.map((flow) => (
            <section key={flow.id} aria-labelledby={`${flow.id}-heading`}>
              <h2 id={`${flow.id}-heading`}>{flow.title}</h2>
              <p>{flow.introduction}</p>
              <p>
                {copy.currentSetting}: {' '}
                {readPreference(flow.id) ? copy.enabled : copy.disabled}
              </p>
              <button
                type="button"
                aria-describedby={`${flow.id}-heading`}
                onClick={() => setScreen({ kind: 'settings', flow })}
              >
                {copy.openSettings}
              </button>
            </section>
          ))}
        </>
      )}
      {screen.kind === 'settings' && (
        <section>
          <h1 tabIndex={-1} data-screen-heading>
            {screen.flow.settingsTitle}
          </h1>
          <p>{screen.flow.settingsDescription}</p>
          <PreferenceCard
            key={screen.flow.id}
            id={screen.flow.id}
            onCancel={() => setScreen({ kind: 'list' })}
            onSaved={(result) =>
              setScreen({ kind: 'result', flow: screen.flow, result })
            }
          />
        </section>
      )}
      {screen.kind === 'result' && (
        <PreferencesResult
          result={screen.result}
          onBack={() => setScreen({ kind: 'list' })}
          onEdit={() => setScreen({ kind: 'settings', flow: screen.flow })}
        />
      )}
    </main>
  );
}
