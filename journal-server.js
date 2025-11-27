import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import { createSequelize } from "./src/config/db.js";
import defineWorkJournalModel from "./src/models/workJournalLog.js";
import defineUserModel from "./src/models/user-temp.js"; // we will create temp

const app = express();
app.disable("x-powered-by");
app.use(bodyParser.json());
app.use(express.static("src/public"));
app.use(express.static("src/views"));

const sequelize = createSequelize({
  databaseUrl: process.env.DATABASE_URL,
  sslMode: "disable"
});

const User = defineUserModel(sequelize);
const WorkJournalLog = defineWorkJournalModel(sequelize);

await sequelize.sync({ alter: true });

// TEMP no-auth version
app.post("/journal", async (req, res) => {
  const user = await User.findOne(); // always use first user
  const entry = await WorkJournalLog.upsert({
    user_id: user.id,
    ...req.body
  });
  res.json({ success: true, entry });
});

app.get("/journal", async (req, res) => {
  const logs = await WorkJournalLog.findAll();
  res.json({ success: true, logs });
});

app.get("/journal-ui", (req, res) => {
  res.sendFile("journal.html", { root: "src/views" });
});

let user = await User.findOne();
if (!user) {
  user = await User.create({ email: "test@ucsd.edu" });
}

// Update an entry
app.put("/journal/:id", async (req, res) => {
  try {
    const entry = await WorkJournalLog.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: "Entry not found" });

    await entry.update(req.body);

    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an entry
app.delete("/journal/:id", async (req, res) => {
  try {
    const entry = await WorkJournalLog.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: "Entry not found" });

    await entry.destroy();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Journal UI temp server running at http://localhost:3000/journal-ui"));