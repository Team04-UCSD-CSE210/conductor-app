import {Router} from "express";
import {ensureAuthenticated} from "../middleware/auth.js";
import {JournalModel} from "../models/journal-model.js";

const router = Router();

// Create or upsert journal entry
router.post("/", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser; // authenticated user
    const entry = await JournalModel.upsert({
      user_id: user.id,
      ...req.body,
    });
    res.json({ success: true, entry });
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Something went wrong!" });
  }
});

// Get all journal entries for authenticated user
router.get("/", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    const logs = await JournalModel.findByUser(user.id);
    res.json({ success: true, logs });
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Something went wrong!" });  }
});

// Serve journal UI
router.get("/journal-ui", ensureAuthenticated, (req, res) => {
  res.sendFile("journal-temp.html", { root: "src/views" });
});

// Update a journal entry (only if belongs to current user)
router.put("/:id", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    const entry = await JournalModel.findById(req.params.id);
    if (!entry || entry.user_id !== user.id)
      return res.status(404).json({ error: "Entry not found" });

    const updated = await JournalModel.update(req.params.id, req.body);
    res.json({ success: true, entry: updated });
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Something went wrong!" });
  }
});

// Delete a journal entry (only if belongs to current user)
router.delete("/:id", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    const entry = await JournalModel.findById(req.params.id);
    if (!entry || entry.user_id !== user.id)
      return res.status(404).json({ error: "Entry not found" });

    await JournalModel.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Something went wrong!" });
  }
});

export default router;