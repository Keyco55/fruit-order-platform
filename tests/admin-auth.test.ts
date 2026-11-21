import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createAdminSessionToken,
  verifyAdminSessionToken,
} from "../src/lib/admin-auth";
import { verifyPassword } from "../src/lib/password";
import { createInitialSeedData } from "../src/lib/store";

describe("관리자 인증 및 초기 비밀번호 검증", () => {
  it("초기 비밀번호는 환경값에서 hash로 저장한다", () => {
    const seed = createInitialSeedData();
    assert.ok(seed.settings.admin_pin.startsWith("scrypt$"));
    assert.ok(
      verifyPassword(
        process.env.ADMIN_INITIAL_PASSWORD!,
        seed.settings.admin_pin,
      ),
    );
  });

  it("서명된 관리자 세션 토큰을 생성하고 검증할 수 있어야 한다", () => {
    const now = 1_700_000_000;
    const token = createAdminSessionToken(now);
    assert.equal(verifyAdminSessionToken(token, now + 60), true);
  });

  it("만료되거나 변조된 관리자 세션 토큰은 거부되어야 한다", () => {
    const now = 1_700_000_000;
    const token = createAdminSessionToken(now);
    assert.equal(verifyAdminSessionToken(token, now + 60 * 60 * 13), false);

    const [payload, sig] = token.split(".");
    const tampered = `${payload}.${sig.slice(0, -1)}${sig.endsWith("a") ? "b" : "a"}`;
    assert.equal(verifyAdminSessionToken(tampered, now + 10), false);
    assert.equal(verifyAdminSessionToken(undefined, now), false);
  });
});
