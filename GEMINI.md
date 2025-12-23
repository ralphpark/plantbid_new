# 프로젝트 개요 (Project Overview)

이 프로젝트는 TypeScript로 구축된 풀스택 웹 애플리케이션으로, React 프론트엔드와 Express 백엔드를 특징으로 합니다. 사용자와 판매자를 연결하는 식물 마켓플레이스 또는 입찰 플랫폼("PlantBid")으로 보입니다.

## 기술 스택 (Tech Stack)

*   **언어:** TypeScript
*   **프론트엔드:**
    *   **프레임워크:** React (Vite)
    *   **라우팅:** wouter
    *   **스타일링:** Tailwind CSS, Shadcn UI (@radix-ui)
    *   **상태/데이터:** React Query (@tanstack/react-query)
    *   **아이콘:** Lucide React
*   **백엔드:**
    *   **런타임:** Node.js
    *   **프레임워크:** Express
    *   **데이터베이스:** PostgreSQL (Neon/Supabase), Drizzle ORM 사용
    *   **인증:** Passport.js (Local Strategy)
    *   **실시간:** WebSockets (`ws`)
*   **통합 (Integrations):**
    *   **AI:** Google Gemini (`@google/generative-ai`), OpenAI
    *   **결제:** Stripe, PortOne
    *   **지도:** Google Maps API

## 아키텍처 (Architecture)

*   **`client/`**: React 프론트엔드 애플리케이션을 포함합니다.
    *   빌드 및 개발에 Vite를 사용합니다.
    *   별칭(Aliases): `@`는 `client/src`에 매핑됩니다.
*   **`server/`**: Express 백엔드 애플리케이션을 포함합니다.
    *   `index.ts`: 진입점(Entry point)입니다.
    *   `routes.ts`: 주요 API 라우트 정의입니다.
    *   `api_direct_router.ts` / `direct-router.ts`: 특정 미들웨어를 우회하는 별도 라우터입니다.
*   **`shared/`**: 프론트엔드와 백엔드 간에 공유되는 코드입니다.
    *   `schema.ts`: Drizzle ORM 스키마 정의 및 Zod 타입입니다.
*   **`migrations/`**: 데이터베이스 마이그레이션 (Drizzle Kit)입니다.

## 주요 명령어 (Key Commands)

*   **개발 (Development):**
    ```bash
    npm run dev
    ```
    `tsx`를 사용하여 백엔드 서버를 시작하고 변경 사항을 감시합니다(개발 모드에서 프론트엔드 프록시/서빙도 수행).

*   **빌드 (Build):**
    ```bash
    npm run build
    ```
    Vite를 사용하여 프론트엔드를 빌드하고 `esbuild`를 사용하여 백엔드를 번들링합니다. 결과물은 `dist/`에 저장됩니다.

*   **프로덕션 (Production):**
    ```bash
    npm run start
    ```
    `dist/index.js`에서 빌드된 애플리케이션을 실행합니다.

*   **데이터베이스 (Database):**
    ```bash
    npm run db:push
    ```
    스키마 변경 사항을 연결된 데이터베이스에 푸시합니다.

*   **타입 체크 (Type Check):**
    ```bash
    npm run check
    ```
    오류 확인을 위해 TypeScript 컴파일러를 실행합니다.

## 개발 규칙 (Development Conventions)

*   **환경 변수:** `.env` 파일을 통해 관리됩니다. 주요 변수로는 `DATABASE_URL`(또는 `SUPABASE_DB_URL`), AI 및 결제용 API 키가 있습니다.
*   **데이터베이스:** 접근은 엄격하게 Drizzle ORM을 통해서만 이루어집니다. 스키마 정의는 `shared/schema.ts`에 있습니다.
*   **API 구조:** API 라우트는 일반적으로 `/api` 접두사를 사용합니다. 특정 사용 사례나 특정 미들웨어 우회를 위한 "direct" 라우트(`/direct`, `/__direct`)도 존재합니다.
*   **유효성 검사:** 런타임 유효성 검사에 Zod가 사용되며, 종종 Drizzle 스키마(`drizzle-zod`)에서 직접 파생됩니다.
*   **스타일링:** Tailwind CSS가 주요 스타일링 솔루션이며, 컴포넌트 전반에 걸쳐 유틸리티 클래스가 사용됩니다.

## MCP (Model-Context-Protocol) 서버 통합

이 프로젝트에는 Vercel 및 Supabase와 상호 작용하기 위한 MCP 서버가 포함되어 있습니다. 이를 통해 AI 기반 개발 도구를 사용하여 배포를 관리하고 데이터베이스와 상호 작용할 수 있습니다.

### MCP 환경 변수

MCP 서버를 활성화하려면 다음 환경 변수를 `.env` 파일에 추가해야 합니다.

*   `SUPABASE_URL`: Supabase 프로젝트의 URL입니다.
*   `SUPABASE_SERVICE_KEY`: Supabase 프로젝트의 서비스 역할 키입니다. 관리자 수준 권한을 가집니다.
*   `SUPABASE_ANON_KEY`: Supabase 프로젝트의 익명 키입니다. 클라이언트 측에서 안전하게 사용할 수 있습니다.
*   `SUPABASE_SCHEMA`: (선택 사항) 사용할 데이터베이스 스키마입니다. 기본값은 `public`입니다.
*   `VERCEL_TOKEN`: Vercel 프로젝트에 접근하기 위한 Vercel API 토큰입니다.

## 디렉토리 구조 (Directory Structure)

```
/
├── client/           # React frontend (React 프론트엔드)
├── server/           # Express backend (Express 백엔드)
├── shared/           # Shared types and schema (공유 타입 및 스키마)
├── scripts/          # Utility scripts (유틸리티 스크립트)
├── uploads/          # User-uploaded content (사용자 업로드 콘텐츠)
├── public/           # Static assets (정적 자산)
├── drizzle.config.ts # Drizzle ORM config (Drizzle ORM 설정)
├── vite.config.ts    # Vite config (Vite 설정)
└── package.json      # Dependencies and scripts (의존성 및 스크립트)
```
## 언어 설정 (Language Settings)

*   **기본 언어:** 한국어 (Korean)
*   모든 대화, 주석, 문서화는 **한국어**로 작성하는 것을 원칙으로 합니다.
*   사용자에게 표시되는 에러 메시지 또한 반드시 한국어로 제공되어야 합니다.
