import {Router} from "express";
import {ensureAuthenticated} from "../middleware/auth.js";
import {TAJournalModel} from "../models/ta-journal-model.js";

const router = Router();

// Create or upsert TA journal entry
router.post("/", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    console.log("POST /api/ta-journals - User:", user ? user.id : "NO USER");
    
    if (!user) {
      return res.status(401).json({ error: "User not authenticated", success: false });
    }
    
    const entry = await TAJournalModel.upsert({
      user_id: user.id,
      ...req.body,
    });
    res.json({ success: true, entry });
  } catch (err) {
    console.error("Error in POST /api/ta-journals:", err);
    res.status(500).json({ error: "Something went wrong!", success: false });
  }
});

// Get all TA journal entries for authenticated user
router.get("/", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    
    if (!user) {
      return res.status(401).json({ error: "User not authenticated", success: false });
    }
    
    const logs = await TAJournalModel.findByUser(user.id);
    res.json({ success: true, logs });
  } catch (err) {
    console.error("Error in GET /api/ta-journals:", err);
    res.status(500).json({ error: "Something went wrong!", success: false });
  }
});

// Update a TA journal entry
router.put("/:id", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    const entry = await TAJournalModel.findById(req.params.id);
    if (!entry || entry.user_id !== user.id)
      return res.status(404).json({ error: "Entry not found", success: false });

    const updated = await TAJournalModel.update(req.params.id, req.body);
    res.json({ success: true, entry: updated });
  } catch (err) {
    console.error("Error in PUT /api/ta-journals:", err);
    res.status(500).json({ error: "Something went wrong!", success: false });
  }
});

// Delete a TA journal entry
router.delete("/:id", ensureAuthenticated, async (req, res) => {
  try {
    const user = req.currentUser;
    const entry = await TAJournalModel.findById(req.params.id);
    if (!entry || entry.user_id !== user.id)
      return res.status(404).json({ error: "Entry not found", success: false });

    await TAJournalModel.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE /api/ta-journals:", err);
    res.status(500).json({ error: "Something went wrong!", success: false });
  }
});

export default router;
