import { env } from "cloudflare:workers";

export type RuntimeEnv = {
  DB?: D1Database;
  UPLOADS?: R2Bucket;
  MIKAEL_OWNER_USER_ID?: string;
  MIKAEL_OWNER_EMAIL?: string;
};

export function getRuntimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}
