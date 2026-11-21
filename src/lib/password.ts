import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (password.length > 256 || stored === "!unconfigured") return false;
  if (stored.startsWith("scrypt$")) {
    const [, salt, digest] = stored.split("$");
    if (
      !/^[a-f0-9]{32}$/.test(salt ?? "") ||
      !/^[a-f0-9]{128}$/.test(digest ?? "")
    )
      return false;
    return timingSafeEqual(
      scryptSync(password, salt, 64),
      Buffer.from(digest, "hex"),
    );
  }
  // 기존 평문은 성공한 로그인에서만 hash로 전환한다. 비밀번호 자체는 변경하지 않는다.
  const actual = Buffer.from(password);
  const expected = Buffer.from(stored);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
