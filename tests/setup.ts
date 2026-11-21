import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

// Each test process owns a distinct store; never touch an interactive demo or production service.
process.env.FRUIT_STORE_PATH = join(
  mkdtempSync(join(tmpdir(), "fruit-unit-")),
  "store.json",
);
process.env.FRUIT_DEMO_MODE = "true";
process.env.ADMIN_SESSION_SECRET = randomBytes(48).toString("base64url");
process.env.ADMIN_INITIAL_PASSWORD = "QA-only-initial-password";
delete process.env.VERCEL;
delete process.env.VERCEL_ENV;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.TELEGRAM_CHAT_ID;
