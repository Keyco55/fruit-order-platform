# DB 설치·업그레이드 안내

운영 DB에 자동 적용하지 않는다. 백업·기존 데이터 점검·전용 테스트 DB 검증·Human 승인 후 진행한다.

## 신규 DB

- 수동 설치: 현재 최종 상태인 `schema.sql`을 적용한다.
- migration 기반 설치: `202611190000_baseline.sql` → `202611200001_senior_qa_round2.sql` 순서로 적용한다.
- 이미 `schema.sql`로 설치한 DB에 baseline을 별도 업그레이드처럼 실행하지 않는다. CLI migration history를 사용할 경우 실제 적용 상태와 이력을 먼저 조정한다.

## 기존 DB / 1차 보안 수정이 수동 적용된 DB

기존 DB에는 `migrations/202611200001_senior_qa_round2.sql`을 적용한다. 기존 idempotency 컬럼·재고 제약·FK 변경이 수동 적용돼 있어도 데이터 삭제 없이 실행되도록 작성했다.

- 추가: 재고 버전·변경 trigger, 주문 요청 fingerprint, 고객 검색 정규화 컬럼·index, 공유 rate-limit 테이블·RPC.
- 보강: 새 11인자 RPC에서 같은 요청키를 advisory transaction lock으로 직렬화하고 내용이 다르면 거절. 기존 9인자 RPC는 제거한다.
- 단계적 배포 호환: 기존 10인자 RPC는 현재 서버를 위해 유지하고 service_role에만 실행을 허용한다. 새 11인자 RPC는 모든 인자가 필수이며 새 서버가 11개를 모두 전달하므로 호출이 모호해지지 않는다. 기존 10인자의 요청 내용 검증은 이전 동작 수준이며, 새 앱의 검증을 대신하지 않는다.
- 보존: 주문·주문 품목·상품·매장 설정. 기존 관리자 비밀번호 값은 migration에서 초기화하지 않는다.
- 기존 재고가 제약에 어긋나거나 요청키가 중복됐다면 임의 보정하지 않고 transaction을 중단한다. 원인을 검토한 뒤 승인받고 처리한다.
- 기존 요청키에 fingerprint가 없으면 재사용 요청을 거절한다. 과거 주문 접수를 확인하고, 이전 브라우저 탭은 새 버전으로 갱신한다.
- DB를 먼저 적용하고 앱을 나중에 배포할 수 있다. 새 앱 배포·구버전 트래픽 종료·rollback 계획을 확인한 뒤, 별도 승인된 후속 migration으로 기존 10인자 RPC를 제거한다. 지금 제거하면 현재 배포나 rollback 버전의 접수가 실패한다.
- 운영에 이 upgrade SQL을 Management API로 수동 적용했다면 CLI migration history에 자동 등록되지는 않는다. 기존 DB에 baseline을 덮어쓰거나 확인 없이 `supabase db push`하지 않는다. 실제 SQL 적용 상태와 migration history를 먼저 조정한다.

## 배포 전 환경 설정

- `ADMIN_SESSION_SECRET`: 32바이트 이상 난수, 서버 전용. 실제 값을 Git·문서·채팅에 기록하지 않는다.
- `ADMIN_INITIAL_PASSWORD`: 신규 설치 또는 미설정 상태의 관리자 초기화에만 사용. 기존 비밀번호는 최초 성공 로그인에서 같은 비밀번호의 scrypt hash로 전환된다.
- 현재 로그인 세션은 새 검증 형식과 맞지 않으므로 재로그인한다. 비밀번호 변경은 기존 세션 모두를 무효화한다.
- Supabase URL·service-role key가 없는 운영/preview 환경은 접수하지 않는다. `FRUIT_DEMO_MODE`는 로컬 테스트 전용이다.
- 로그인·고객 조회 rate limit은 Supabase 모드에서 공유 DB를 사용한다. 관련 RPC가 없거나 실패하면 우회하지 않고 요청을 실패시킨다.
- Vercel에서는 플랫폼의 client-IP header를 사용한다. 다른 서버에서 `TRUST_PROXY=true`는 proxy가 header를 확실히 덮어쓸 때만 사용한다. 기본값은 공통 bucket이다.
- bot은 고유 `messageId`가 필요하고, 문의·취소·모호한 상품은 접수하지 않는다. 웹 주문 공유 메시지는 신규 접수하지 않는다.

## 로컬 SQL 검증

`scripts/verify-migrations.mjs`는 별도 설치된 PGlite(+pgcrypto)로 메모리 DB만 검증한다. 프로젝트 runtime dependency에 PGlite를 추가하지 않았다.

```sh
PGLITE_MODULE=/path/to/pglite/dist/index.js node scripts/verify-migrations.mjs
```

검사: baseline→upgrade, upgrade 재실행, 기존 주문 보존, 신/구 RPC 호출·재시도·내용 충돌, 재고 버전·제약, rate limit, 상품 삭제 후 주문 품목 보존, RPC 권한, 신규 schema 재실행.

PGlite 검증은 실제 Supabase/PostgREST/RLS 환경 검증과 독립 서버 간 부하 테스트를 대신하지 않는다. 운영 적용 전 전용 Supabase에서 확인한다.
