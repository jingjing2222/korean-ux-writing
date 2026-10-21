import React, { useState } from 'react';

type Result = 'pending' | 'confirmed' | 'declined';
type Stage = 'signup' | 'review' | Result | 'cancelled';
type Props = { submitPayment: (email: string) => Promise<Result> };

export function Checkout({ submitPayment }: Props) {
  const [stage, setStage] = useState<Stage>('signup');
  const [email, setEmail] = useState('');
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const price = '6,900원';

  const goToReview = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInvalidEmail(true);
      return;
    }
    setInvalidEmail(false);
    setStage('review');
  };

  const pay = async () => {
    if (!agreed || busy) return;
    setBusy(true);
    try {
      setStage(await submitPayment(email));
    } catch {
      setStage('pending');
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'signup') return <main>
    <h1>더 나은 일상을 위한 스마트한 구독 경험</h1>
    <p>이메일을 입력하면 결제 정보를 확인할 수 있습니다.</p>
    <label htmlFor="email">이메일 주소</label>
    <input id="email" value={email} onChange={e => setEmail(e.target.value)}
      placeholder="이메일 주소를 입력하세요" aria-describedby={invalidEmail ? 'email-error' : undefined} />
    {invalidEmail && <p id="email-error" role="alert">유효하지 않은 이메일 형식입니다.</p>}
    <button onClick={goToReview}>다음</button>
    <button onClick={() => setStage('cancelled')}>취소</button>
  </main>;

  if (stage === 'review') return <main>
    <h1>모든 준비가 완료되었습니다!</h1>
    <p>{email} 계정으로 신청합니다.</p>
    <p>월 {price}, 다음 달 같은 날부터 매월 자동 결제됩니다.</p>
    <label><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
      [필수] 정기 결제 조건에 동의합니다.</label>
    <button onClick={pay} disabled={!agreed || busy}>{busy ? '처리 중...' : '구독 시작'}</button>
    <button onClick={() => setStage('signup')} disabled={busy}>뒤로</button>
  </main>;

  if (stage === 'pending') return <main>
    <h1>결제가 성공적으로 완료되었습니다.</h1>
    <p>잠시만 기다려 주시면 구독을 사용할 수 있습니다.</p>
    <a href="/billing/status">확인</a>
  </main>;

  if (stage === 'confirmed') return <main>
    <h1>요청이 처리되었습니다.</h1>
    <p>월 {price} 구독을 사용할 수 있습니다.</p>
    <a href="/library">시작하기</a>
  </main>;

  if (stage === 'declined') return <main>
    <h1>작업 수행에 실패했습니다.</h1>
    <p>네트워크 문제입니다. 다시 결제하면 해결됩니다.</p>
    <a href="/billing/methods">확인</a>
    <a href="/support">문의</a>
  </main>;

  return <main><h1>구독 신청이 취소되었습니다.</h1><a href="/plans">돌아가기</a></main>;
}
