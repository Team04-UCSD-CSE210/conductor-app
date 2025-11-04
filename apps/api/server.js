// apps/api/server.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";

import healthRouter from "./routes/health.js";
import statusRouter from "./routes/status.js";
import usersRouter from "./routes/users.js";
import classesRouter from "./routes/classes.js";
import uiRouter from "./routes/ui.js";

export function buildApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://cdn.tailwindcss.com", "https://unpkg.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          baseUri: ["'self'"],
          frameAncestors: ["'self'"],
        },
      },
    })
  );

  app.use(cors());
  app.use(express.json());
  app.use(morgan("dev"));

  // API routes
  app.use("/api/v1", healthRouter);
  app.use("/api/v1", statusRouter);
  app.use("/api/v1", usersRouter);
  app.use("/api/v1", classesRouter);

  // UI routes
  app.use("/", uiRouter);

  /* c8 ignore next */
  if (process.env.NODE_ENV === "test") {

    app.get("/api/v1/_boom", (_req, _res) => {
      throw new Error("boom");
    });
  }

  // Not found handler
  app.use((req, res) => {
    res.status(404).json({ error: true, message: `Not found: ${req.originalUrl}` });
  });

  // Error handler
  app.use((err, req, res, _next) => {

    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: true, message: err?.message ?? "Internal Server Error" });
  });

  return app;
}
