// apps/api/routes/users.js
import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.resolve(__dirname, "..", "data", "users.json");
let users = [];
try {
  users = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
} catch {
  users = [];
}

const router = Router();

// list
router.get("/users", (req, res) => {
  res.json(users);
});

// detail
router.get("/users/:id", (req, res) => {
  const one = users.find((u) => String(u.id) === String(req.params.id));
  if (!one) return res.status(404).json({ error: true, message: "User not found" });
  res.json(one);
});

// create (require: name)
router.post("/users", (req, res) => {
  const body = req.body || {};
  const name = String(body.name ?? "").trim();
  if (!name) {
    return res.status(400).json({ error: true, message: "name is required" });
  }

  const id = body.id ?? (users.length ? Math.max(...users.map((u) => Number(u.id) || 0)) + 1 : 1);
  const newUser = { id, name, email: String(body.email ?? "").trim() };
  users.push(newUser);
  fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));
  res.status(201).json(newUser);
});

// update
router.put("/users/:id", (req, res) => {
  const idx = users.findIndex((u) => String(u.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: true, message: "User not found" });
  const patch = { ...req.body };
  if (typeof patch.name === "string") patch.name = patch.name.trim();
  if (typeof patch.email === "string") patch.email = patch.email.trim();
  users[idx] = { ...users[idx], ...patch };
  fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));
  res.json(users[idx]);
});

// delete
router.delete("/users/:id", (req, res) => {
  const idx = users.findIndex((u) => String(u.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: true, message: "User not found" });
  const removed = users.splice(idx, 1)[0];
  fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));
  res.json(removed);
});

export default router;
