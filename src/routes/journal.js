import express from "express";
const ensureAuthenticated = (req, res, next) =>
  req.app.locals.ensureAuthenticated(req, res, next);
import {
  createOrUpdateJournal,
  getMyJournalEntries,
  getJournalForDate
} from "../controllers/journalController.js";

const router = express.Router();

router.post("/", ensureAuthenticated, createOrUpdateJournal);
router.get("/", ensureAuthenticated, getMyJournalEntries);
router.get("/:date", ensureAuthenticated, getJournalForDate);

export default router;