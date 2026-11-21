// Optional local-only SQL verification. No hosted database or credentials are used.
// Provide PGLITE_MODULE pointing at an independently installed @electric-sql/pglite module.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const { pgcrypto } = await import(
  process.env.PGLITE_MODULE
    ? process.env.PGLITE_MODULE.replace(/index[.]js$/, "contrib/pgcrypto.js")
    : "@electric-sql/pglite/contrib/pgcrypto"
);
const base = new URL("../supabase/", import.meta.url);
const read = async (name) => await readFile(new URL(name, base), "utf8");
const baseline = await read("migrations/202611190000_baseline.sql");
const migration = await read("migrations/202611200001_senior_qa_round2.sql");
const canonical = await read("schema.sql");
const roles =
  "create role anon; create role authenticated; create role service_role bypassrls;";
const old = new PGlite({ extensions: { pgcrypto } });
await old.exec(roles);
await old.exec(baseline);
const pid = "00000000-0000-4000-8000-000000000001";
await old.query(
  "insert into public.products(id,name,price,total_stock,remain_stock) values($1,'QA fruit',1000,9,9)",
  [pid],
);
await old.query("insert into public.store_settings(admin_pin) values($1)", [
  "QA-only-legacy-password",
]);
const legacy = await old.query(
  "select public.create_fruit_order(p_kakao_nickname => 'QA legacy', p_items => $1::jsonb) as id",
  [JSON.stringify([{ product_id: pid, quantity: 1 }])],
);
await old.exec(migration);
await old.exec(migration); // Already manually upgraded installations must also be safe.
assert.equal(
  (await old.query("select count(*)::int as n from public.orders")).rows[0].n,
  1,
);
assert.equal(
  (await old.query("select id from public.orders")).rows[0].id,
  legacy.rows[0].id,
);
const items = JSON.stringify([{ product_id: pid, quantity: 2 }]);
const call =
  "select public.create_fruit_order(p_kakao_nickname => $1, p_customer_phone => '', p_customer_phone_last4 => '', p_fulfillment_type => null, p_delivery_address => '', p_pickup_time => null, p_memo => '', p_source => 'WEB', p_items => $2::jsonb, p_idempotency_key => $3, p_request_fingerprint => $4) as id";
const first = await old.query(call, [
  "QA retry",
  items,
  "QA_RPC_STABLE_KEY",
  "a".repeat(64),
]);
const retry = await old.query(call, [
  "QA retry",
  items,
  "QA_RPC_STABLE_KEY",
  "a".repeat(64),
]);
assert.equal(first.rows[0].id, retry.rows[0].id);
await assert.rejects(
  () =>
    old.query(call, ["QA changed", items, "QA_RPC_STABLE_KEY", "b".repeat(64)]),
  /요청키/,
);
assert.equal(
  (
    await old.query("select remain_stock from public.products where id=$1", [
      pid,
    ])
  ).rows[0].remain_stock,
  6,
);
const stale = await old.query(
  "update public.products set remain_stock=8 where id=$1 and stock_version=0 returning id",
  [pid],
);
assert.equal(stale.rows.length, 0);
await old.query("update public.products set name='QA renamed' where id=$1", [
  pid,
]);
assert.equal(
  (
    await old.query("select remain_stock from public.products where id=$1", [
      pid,
    ])
  ).rows[0].remain_stock,
  6,
);
await assert.rejects(() =>
  old.query("update public.products set remain_stock=10 where id=$1", [pid]),
);
// DB 먼저 적용하고 앱은 나중에 배포해도 기존 10인자 호출이 유지되어야 한다.
const compatible = await old.query(
  "select public.create_fruit_order(p_kakao_nickname => 'QA old deployment', p_items => $1::jsonb, p_idempotency_key => 'QA_OLD_RPC_STABLE') as id",
  [JSON.stringify([{ product_id: pid, quantity: 1 }])],
);
const compatibleRetry = await old.query(
  "select public.create_fruit_order(p_kakao_nickname => 'QA old deployment', p_items => $1::jsonb, p_idempotency_key => 'QA_OLD_RPC_STABLE') as id",
  [JSON.stringify([{ product_id: pid, quantity: 1 }])],
);
assert.equal(compatible.rows[0].id, compatibleRetry.rows[0].id);
assert.equal(
  (await old.query("select remain_stock from public.products where id=$1", [pid])).rows[0].remain_stock,
  5,
);
assert.deepEqual(
  (await old.query("select pronargs::int as n, pronargdefaults::int as defaults from pg_proc where oid in ('public.create_fruit_order(text,text,text,text,text,text,text,text,jsonb,text)'::regprocedure, 'public.create_fruit_order(text,text,text,text,text,text,text,text,jsonb,text,text)'::regprocedure) order by pronargs")).rows,
  [{ n: 10, defaults: 9 }, { n: 11, defaults: 0 }],
);
assert.equal(
  (await old.query("select has_function_privilege('anon','public.create_fruit_order(text,text,text,text,text,text,text,text,jsonb,text)','execute') as ok")).rows[0].ok,
  false,
);
assert.equal(
  (
    await old.query("select public.consume_fruit_rate_limit($1,2,600) as ok", [
      "c".repeat(64),
    ])
  ).rows[0].ok,
  true,
);
assert.equal(
  (
    await old.query("select public.consume_fruit_rate_limit($1,2,600) as ok", [
      "c".repeat(64),
    ])
  ).rows[0].ok,
  true,
);
assert.equal(
  (
    await old.query("select public.consume_fruit_rate_limit($1,2,600) as ok", [
      "c".repeat(64),
    ])
  ).rows[0].ok,
  false,
);
await old.query("delete from public.products where id=$1", [pid]);
assert.equal(
  (
    await old.query(
      "select count(*)::int as n from public.order_items where product_id is null",
    )
  ).rows[0].n,
  3,
);
assert.equal(
  (await old.query("select count(*)::int as n from public.orders")).rows[0].n,
  3,
);
assert.equal(
  (
    await old.query(
      "select has_function_privilege('anon','public.create_fruit_order(text,text,text,text,text,text,text,text,jsonb,text,text)','execute') as ok",
    )
  ).rows[0].ok,
  false,
);
assert.equal(
  (
    await old.query(
      "select has_function_privilege('service_role','public.create_fruit_order(text,text,text,text,text,text,text,text,jsonb,text,text)','execute') as ok",
    )
  ).rows[0].ok,
  true,
);
await old.close();
const fresh = new PGlite({ extensions: { pgcrypto } });
await fresh.exec(roles);
await fresh.exec(canonical);
await fresh.exec(canonical);
await fresh.close();
console.log(
  "SQL PASS: baseline → upgrade ×2, existing orders, legacy/new RPC compatibility, replay, payload conflict, stock version, stock constraint, rate limit, FK history, RPC permissions, fresh schema ×2",
);
