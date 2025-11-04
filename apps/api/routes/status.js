// apps/api/routes/status.js
import { Router } from "express";
const router = Router();

router.get("/status", (_req, res) => {
  res.json({ ok: true, service: "api", version: "1.0.0", uptime: process.uptime(), ts: Date.now() });
});

export default router;
