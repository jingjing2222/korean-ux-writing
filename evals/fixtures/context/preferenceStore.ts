export type PreferenceId = 'course-mail' | 'headphones-background';

export type SavedPreference = {
  id: PreferenceId;
  enabled: boolean;
  title: string;
  description: string;
};

// This fixture uses process-local mock storage. Reloading restores these defaults.
// It does not send email, pair a device, or verify a physical connection.
const values: Record<PreferenceId, boolean> = {
  'course-mail': false,
  'headphones-background': true,
};

const savedMessages: Record<
  PreferenceId,
  { title: string; enabled: string; disabled: string }
> = {
  'course-mail': {
    title: '수신 설정을 저장했어요',
    enabled: '새 강의 소식을 이메일로 받도록 설정했어요.',
    disabled: '새 강의 소식을 이메일로 받지 않도록 설정했어요.',
  },
  'headphones-background': {
    title: '연결 설정을 저장했어요',
    enabled: '백그라운드에서 연결을 유지하도록 설정했어요.',
    disabled: '백그라운드에서 연결을 유지하지 않도록 설정했어요.',
  },
};

export function readPreference(id: PreferenceId): boolean {
  return values[id];
}

export async function updatePreference(
  id: PreferenceId,
  enabled: boolean,
): Promise<SavedPreference> {
  values[id] = enabled;
  const messages = savedMessages[id];
  return {
    id,
    enabled,
    title: messages.title,
    description: enabled ? messages.enabled : messages.disabled,
  };
}
