import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const required = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
for (const key of required) {
  if (!process.env[key] || process.env[key].includes("CHANGEZ_MOI")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Variable ${key} obligatoire en production`);
    }
  }
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,
  isProd: process.env.NODE_ENV === "production",
  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_SECRET ||
      "dev-only-access-secret-min-32-chars-long!!",
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      "dev-only-refresh-secret-min-32-chars-long!",
    accessExpires: "15m",
    refreshExpires: "7d",
  },
  dbPath: path.resolve(
    process.env.DATABASE_PATH || path.join(__dirname, "../data/sac.db")
  ),
  uploadDir: path.resolve(
    process.env.UPLOAD_DIR || path.join(__dirname, "../uploads")
  ),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  cookieSecure: process.env.COOKIE_SECURE === "true",
  maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS) || 5,
  lockoutMinutes: Number(process.env.LOCKOUT_MINUTES) || 15,
  rootDir: path.resolve(__dirname, "../.."),
};
