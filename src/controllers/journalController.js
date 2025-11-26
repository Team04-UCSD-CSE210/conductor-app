export const createOrUpdateJournal = async (req, res) => {
  try {
    const WorkJournalLog = req.app.get("models").WorkJournalLog;
    const { date, done_since_yesterday, working_on_today, blockers, feelings } = req.body;

    const entry = await WorkJournalLog.upsert({
      user_id: req.user.id, // ID from users table
      date,
      done_since_yesterday,
      working_on_today,
      blockers,
      feelings
    });

    res.json({ success: true, entry: entry[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Journal entry failed" });
  }
};

export const getMyJournalEntries = async (req, res) => {
  try {
    const WorkJournalLog = req.app.get("models").WorkJournalLog;
    const logs = await WorkJournalLog.findAll({
      where: { user_id: req.user.id },
      order: [["date", "DESC"]]
    });
    res.json({ success: true, logs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
};

export const getJournalForDate = async (req, res) => {
  try {
    const WorkJournalLog = req.app.get("models").WorkJournalLog;
    const log = await WorkJournalLog.findOne({
      where: { user_id: req.user.id, date: req.params.date }
    });
    res.json({ success: true, log });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch log" });
  }
};