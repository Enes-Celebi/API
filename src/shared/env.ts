import * as dotenv from "dotenv";
dotenv.config();

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

export const env = {
  DATABASE_URL: must("DATABASE_URL"),
  BASE_URL: process.env.BASE_URL ?? "http://localhost:4000",
  SESSION_SECRET: must("SESSION_SECRET"),
  SESSION_TTL_DAYS: Number(process.env.SESSION_TTL_DAYS ?? "30"),

  GOOGLE_CLIENT_ID: must("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: must("GOOGLE_CLIENT_SECRET"),
  GOOGLE_REDIRECT_URI: must("GOOGLE_REDIRECT_URI"),

  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
};
