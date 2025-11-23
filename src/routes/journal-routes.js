import {Router} from "express";
import {ensureAuthenticated} from "../middleware/auth.js";

const router = Router();

// Create or upsert journal entry
router.post("/journal", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser; // authenticated user
    const entry = await JournalModel.upsert({
      user_id: user.id,
      ...req.body,
    });
    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all journal entries for authenticated user
router.get("/journal", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    const logs = await JournalModel.findByUser(user.id);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve journal UI
router.get("/journal-ui", ensureAuthenticated, (req, res) => {
  res.sendFile("journal.html", { root: "src/views" });
});

// Update a journal entry (only if belongs to current user)
router.put("/journal/:id", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    const entry = await JournalModel.findById(req.params.id);
    if (!entry || entry.user_id !== user.id)
      return res.status(404).json({ error: "Entry not found" });

    const updated = await JournalModel.update(req.params.id, req.body);
    res.json({ success: true, entry: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a journal entry (only if belongs to current user)
router.delete("/journal/:id", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    const entry = await JournalModel.findById(req.params.id);
    if (!entry || entry.user_id !== user.id)
      return res.status(404).json({ error: "Entry not found" });

    await JournalModel.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;