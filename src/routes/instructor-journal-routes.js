import {Router} from "express";
import {ensureAuthenticated} from "../middleware/auth.js";
import {InstructorJournalModel} from "../models/instructor-journal-model.js";

const router = Router();

// Create or upsert instructor journal entry
router.post("/", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    
    if (!user) {
      return res.status(401).json({ error: "User not authenticated", success: false });
    }
    
    const entry = await InstructorJournalModel.upsert({
      user_id: user.id,
      ...req.body,
    });
    res.json({ success: true, entry });
  } catch (err) {
    console.error("Error in POST /api/instructor-journals:", err);
    res.status(500).json({ error: "Something went wrong!", success: false });
  }
});

// Get all instructor journal entries for authenticated user
router.get("/", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    
    if (!user) {
      return res.status(401).json({ error: "User not authenticated", success: false });
    }
    
    const logs = await InstructorJournalModel.findByUser(user.id);
    res.json({ success: true, logs });
  } catch (err) {
    console.error("Error in GET /api/instructor-journals:", err);
    res.status(500).json({ error: "Something went wrong!", success: false });
  }
});

// Update an instructor journal entry (only if belongs to current user)
router.put("/:id", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    const entry = await InstructorJournalModel.findById(req.params.id);
    if (!entry || entry.user_id !== user.id)
      return res.status(404).json({ error: "Entry not found", success: false });

    const updated = await InstructorJournalModel.update(req.params.id, req.body);
    res.json({ success: true, entry: updated });
  } catch (err) {
    console.error("Error in PUT /api/instructor-journals:", err);
    res.status(500).json({ error: "Something went wrong!", success: false });
  }
});

// Delete an instructor journal entry (only if belongs to current user)
router.delete("/:id", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    const entry = await InstructorJournalModel.findById(req.params.id);
    if (!entry || entry.user_id !== user.id)
      return res.status(404).json({ error: "Entry not found", success: false });

    await InstructorJournalModel.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE /api/instructor-journals:", err);
    res.status(500).json({ error: "Something went wrong!", success: false });
  }
});

export default router;
