import express from "express";
import path from "path";
import fs from "fs";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { getDb } from "./db/database.js";
import { seedIfEmpty } from "./db/seed.js";
import authRoutes from "./routes/auth.js";
import documentRoutes from "./routes/documents.js";
import tariffRoutes from "./routes/tariffs.js";
import platformRoutes from "./routes/platform.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

fs.mkdirSync(config.uploadDir, { recursive: true });

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  })
);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || config.allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error("CORS_BLOCKED"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "RATE_LIMIT", message: "Trop de requêtes. Réessayez plus tard." },
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "AUTH_RATE_LIMIT", message: "Trop de tentatives de connexion." },
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "Smart Academy API", version: "1.0.0" });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/tariffs", tariffRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/platform", platformRoutes);

app.use(
  "/uploads",
  express.static(config.uploadDir, {
    dotfiles: "deny",
    index: false,
    setHeaders(res) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", "inline");
    },
  })
);

app.use(express.static(config.rootDir, { index: "index.html" }));

app.use((err, req, res, next) => {
  if (err.message === "CORS_BLOCKED") {
    return res.status(403).json({ error: "CORS_BLOCKED" });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "FILE_TOO_LARGE", message: "Fichier max 5 Mo" });
  }
  if (err.message === "TYPE_BLOCKED" || err.message === "INVALID_FILE_TYPE") {
    return res.status(400).json({ error: "INVALID_FILE", message: "Type de fichier non autorisé" });
  }
  errorHandler(err, req, res, next);
});

async function start() {
  getDb();
  await seedIfEmpty();

  app.listen(config.port, () => {
    console.log(`[SAC] API sécurisée → http://localhost:${config.port}`);
    console.log(`[SAC] Frontend servi depuis ${config.rootDir}`);
  });
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
