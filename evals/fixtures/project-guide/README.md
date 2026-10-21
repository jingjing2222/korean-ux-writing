# create-desk

대시보드 개발에 필요한 프로젝트와 초기 설정을 만드는 CLI예요. Node.js 24 이상이 필요해요.

## 프로젝트 만들기

```sh
npx create-desk my-desk
```

표시할 예제를 골라요. 예제는 프로젝트를 만든 뒤에도 추가할 수 있어요.

`git init`을 실행한 뒤에는 현재 디렉터리에 프로젝트를 만들 수 있어요. `.git` 외에 다른 파일이 있으면 생성을 중단해요.

```sh
npx create-desk .
```

시작 페이지를 만들어요.

## 개발하기

```sh
cd my-desk
npm run dev
```

`src/main.ts`에서 대시보드를 수정해 주세요. 이 프로젝트는 CSR(Client-Side Rendering)을 사용해요.

## 예제 추가하기

아래 명령으로 통계 예제를 추가할 수 있어요.

```sh
npx create-desk add-example stats
```

첫 예제를 추가할 때 `src/main.ts`가 초기 상태에서 수정되어 있으면 추가를 중단해요. 예제를 한 번 추가한 뒤에는 관리 영역 밖의 코드를 유지하면서 새 예제를 추가해요.

## 결과 내보내기

저장한 결과만 내보낼 수 있어요. 먼저 대시보드에서 결과를 저장한 뒤 실행해 주세요.

```sh
npx create-desk export
```

JSON 파일로 저장해요. 예를 들어 기본 파일명 대신 날짜를 붙이려면 `--name`으로 지정해 주세요.
