import React, { useState } from 'react';

const en = {
  title: 'Write a post',
  body: 'Your post',
  leave: 'Leave',
  save: 'Save draft',
  dialog: 'Leave without saving?',
  keep: 'Keep editing',
  discard: 'Discard changes',
  saved: 'Draft saved',
};

const ko: Record<keyof typeof en, string> = {
  title: '게시글 작성',
  body: '당신의 게시글',
  leave: '나가기',
  save: '초안 저장',
  dialog: '저장하지 않고 떠나시겠습니까?',
  keep: '계속 수정',
  discard: '변경 사항 폐기',
  saved: '초안이 저장되었습니다.',
};

// This fixture stores text only in memory. Closing the component ends the session.
// Entry is the post editor; the terminal screen is the local draft list below.
export function Editor() {
  const [text, setText] = useState('');
  const [draft, setDraft] = useState('');
  const [confirmExit, setConfirmExit] = useState(false);
  const [view, setView] = useState<'editor' | 'list'>('editor');
  const [notice, setNotice] = useState('');

  if (view === 'list') return <main><h1>임시 저장한 글</h1><p>{draft || '저장한 글이 없습니다.'}</p></main>;

  return <main>
    <h1>{ko.title}</h1>
    <label htmlFor="post">{ko.body}</label>
    <textarea id="post" value={text} onChange={e => setText(e.target.value)} />
    <button onClick={() => { setDraft(text); setNotice(ko.saved); }}>{ko.save}</button>
    <button onClick={() => text !== draft ? setConfirmExit(true) : setView('list')}>{ko.leave}</button>
    <p role="status">{notice}</p>
    {confirmExit && <div role="dialog" aria-modal="true" aria-labelledby="leave-title">
      <h2 id="leave-title">{ko.dialog}</h2>
      <button onClick={() => setConfirmExit(false)}>{ko.keep}</button>
      <button onClick={() => { setText(draft); setConfirmExit(false); setView('list'); }}>{ko.discard}</button>
    </div>}
  </main>;
}
