import { it } from "node:test";
import assert from "node:assert/strict";
import { getOrdersSupabase } from "../src/lib/supabase-store";
import { createInitialSeedData } from "../src/lib/store";

it("Supabase 1,201건과 낮은 페이지 반환 상한에서도 끝까지 읽고 DB 조건·안정 정렬을 적용한다", async () => {
  const seed = createInitialSeedData();
  const source = seed.orders[0];
  const rows = Array.from({ length: 1201 }, (_, index) => ({
    ...source,
    id: "qa-" + index,
    order_items: source.items,
  }));
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    cache: globalThis.__FRUIT_SUPABASE_ADMIN__,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://qa.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "QA_DUMMY_NOT_A_REAL_KEY";
  const client = {
    from(table: string) {
      const builder = {
        select(...args: unknown[]) {
          calls.push({ method: "select", args });
          return builder;
        },
        order(...args: unknown[]) {
          calls.push({ method: "order", args });
          return builder;
        },
        eq(...args: unknown[]) {
          calls.push({ method: "eq", args });
          return builder;
        },
        or(...args: unknown[]) {
          calls.push({ method: "or", args });
          return builder;
        },
        neq(...args: unknown[]) {
          calls.push({ method: "neq", args });
          return builder;
        },
        gte(...args: unknown[]) {
          calls.push({ method: "gte", args });
          return builder;
        },
        lte(...args: unknown[]) {
          calls.push({ method: "lte", args });
          return builder;
        },
        in(...args: unknown[]) {
          calls.push({ method: "in", args });
          return builder;
        },
        async range(from: number, to: number) {
          calls.push({ method: "range", args: [from, to] });
          return {
            data: rows.slice(from, Math.min(to + 1, from + 200)),
            count: rows.length,
            error: null,
          };
        },
        then(
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve({
            data: table === "products" ? seed.products : [],
            error: null,
          }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  globalThis.__FRUIT_SUPABASE_ADMIN__ = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    client: client as never,
  };
  try {
    const result = await getOrdersSupabase({
      nickname: source.kakao_nickname,
      phone: source.customer_phone_last4,
      fromDate: source.order_date,
      toDate: source.order_date,
      includeCanceled: false,
    });
    assert.equal(result.length, 1201);
    assert.deepEqual(
      calls.filter((c) => c.method === "range").map((c) => c.args[0]),
      [0, 200, 400, 600, 800, 1000, 1200],
    );
    assert.ok(
      calls.some((c) => c.method === "eq" && c.args[0] === "nickname_lookup"),
    );
    assert.ok(
      calls.some(
        (c) => c.method === "eq" && c.args[0] === "customer_phone_last4",
      ),
    );
    assert.ok(
      calls.some((c) => c.method === "gte" && c.args[0] === "order_date"),
    );
    assert.ok(
      calls.some((c) => c.method === "lte" && c.args[0] === "order_date"),
    );
    assert.ok(calls.some((c) => c.method === "order" && c.args[0] === "id"));
  } finally {
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.key === undefined)
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
    globalThis.__FRUIT_SUPABASE_ADMIN__ = previous.cache;
  }
});
