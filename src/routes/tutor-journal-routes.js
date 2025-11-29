import {Router} from "express";
import {ensureAuthenticated} from "../middleware/auth.js";
import {TutorJournalModel} from "../models/tutor-journal-model.js";

const router = Router();

// Create or upsert Tutor journal entry
router.post("/", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    console.log("POST /api/tutor-journals - User:", user ? user.id : "NO USER");
    
    if (!user) {
      return res.status(401).json({ error: "User not authenticated", success: false });
    }
    
    const entry = await TutorJournalModel.upsert({
      user_id: user.id,
      ...req.body,
    });
    res.json({ success: true, entry });
  } catch (err) {
    console.error("Error in POST /api/tutor-journals:", err);
    res.status(500).json({ error: "Something went wrong!", success: false });
  }
});

// Get all Tutor journal entries for authenticated user
router.get("/", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    
    if (!user) {
      return res.status(401).json({ error: "User not authenticated", success: false });
    }
    
    const logs = await TutorJournalModel.findByUser(user.id);
    res.json({ success: true, logs });
  } catch (err) {
    console.error("Error in GET /api/tutor-journals:", err);
    res.status(500).json({ error: "Something went wrong!", success: false });
  }
});

// Update a Tutor journal entry
router.put("/:id", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    const entry = await TutorJournalModel.findById(req.params.id);
    if (!entry || entry.user_id !== user.id)
      return res.status(404).json({ error: "Entry not found", success: false });

    const updated = await TutorJournalModel.update(req.params.id, req.body);
    res.json({ success: true, entry: updated });
  } catch (err) {
    console.error("Error in PUT /api/tutor-journals:", err);
    res.status(500).json({ error: "Something went wrong!", success: false });
  }
});

// Delete a Tutor journal entry
router.delete("/:id", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    const entry = await TutorJournalModel.findById(req.params.id);
    if (!entry || entry.user_id !== user.id)
      return res.status(404).json({ error: "Entry not found", success: false });

    await TutorJournalModel.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE /api/tutor-journals:", err);
    res.status(500).json({ error: "Something went wrong!", success: false });
  }
});

export default router;
