import {Router} from "express";
import {ensureAuthenticated} from "../middleware/auth.js";
import {JournalModel} from "../models/journal-model.js";

const router = Router();

// Create or upsert journal entry
router.post("/", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser; // authenticated user
    
    if (!user) {
      return res.status(401).json({ error: "User not authenticated", success: false });
    }
    
    const entry = await JournalModel.upsert({
      user_id: user.id,
      ...req.body,
    });
    res.json({ success: true, entry });
  } catch (err) {
    console.error("Error in POST /api/journals:", err);
    res.status(500).json({ error: "Something went wrong!", success: false });
  }
});

// Get all journal entries for authenticated user
router.get("/", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    
    if (!user) {
      return res.status(401).json({ error: "User not authenticated", success: false });
    }
    
    const logs = await JournalModel.findByUser(user.id);
    res.json({ success: true, logs });
  } catch (err) {
    console.error("Error in GET /api/journals:", err);
    res.status(500).json({ error: "Something went wrong!", success: false });
  }
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
  } catch {
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
  } catch {
    res.status(500).json({ error: "Something went wrong!" });
  }
});

export default router;