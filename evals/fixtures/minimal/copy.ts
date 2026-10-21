// Two use sites share one message; both belong in the audit inventory.
export const productContext = { saveResult: 'confirmed', messageTone: '해요체' };
export const copy = {
  saved: '설정이 성공적으로 저장되었습니다',
  back: '저장 기록 보기',
};

export const views = {
  saved: { route: '/settings/saved', state: 'saved', message: copy.saved, action: copy.back },
  history: { route: '/settings/history', state: 'history', message: copy.saved },
};

// This fixture declares its complete route/state graph for mechanical examples.
export const transitions = [{ from: 'saved', to: 'history', trigger: '저장 기록 보기' }];
