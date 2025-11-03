import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

// === Dev-only fake auth: use request header x-dev-user ===
app.use(async (req, _res, next) => {
  const email = (req.headers["x-dev-user"] as string) || "student@ucsd.edu";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) user = await prisma.user.create({ data: { email, name: "Dev User" } });
  // @ts-ignore
  req.user = user;
  next();
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/me", (req, res) => {
  // @ts-ignore
  res.json({ user: req.user });
});

// POST /api/attendance/checkin { sessionId }
app.post("/api/attendance/checkin", async (req, res) => {
  const { sessionId } = req.body;
  // @ts-ignore
  const user = req.user;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  const att = await prisma.attendance.create({
    data: { userId: user.id, sessionId, status: "PRESENT" },
  });
  res.json({ attendance: att });
});

// POST /api/journal { content, mood? }
app.post("/api/journal", async (req, res) => {
  const { content, mood } = req.body;
  // @ts-ignore
  const user = req.user;
  if (!content) return res.status(400).json({ error: "content required" });
  const j = await prisma.journal.create({ data: { userId: user.id, content, mood } });
  res.json({ journal: j });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on :${PORT}`));
