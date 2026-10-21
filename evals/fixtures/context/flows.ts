import type { PreferenceId } from './preferenceStore';

export type PreferenceFlow = {
  id: PreferenceId;
  title: string;
  introduction: string;
  settingsTitle: string;
  settingsDescription: string;
};

export const flows: readonly PreferenceFlow[] = [
  {
    id: 'course-mail',
    title: '새 강의 소식',
    introduction: '새 강의가 열리면 이메일로 알려드려요.',
    settingsTitle: '강의 소식 설정',
    settingsDescription: '새 강의 안내를 이메일로 받을지 선택해 주세요.',
  },
  {
    id: 'headphones-background',
    title: '이어폰 연결',
    introduction:
      '이미 연결된 이어폰을 앱이 백그라운드에 있을 때도 연결해 둘지 설정해요.',
    settingsTitle: '백그라운드 연결 설정',
    settingsDescription:
      '이 앱을 사용하지 않는 동안에도 이어폰 연결을 유지할지 선택해 주세요.',
  },
];
