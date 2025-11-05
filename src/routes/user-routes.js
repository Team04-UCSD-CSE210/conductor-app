import { Router } from 'express';
import multer from 'multer';
import { UserModel } from '../models/user-model.js';
import { UserService } from '../services/user-service.js';
import { RosterService } from '../services/roster-service.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', async (req, res) => {
  try {
    const newUser = await UserModel.create(req.body);
    res.status(201).json(newUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  const users = await UserModel.findAll(limit, offset);
  res.json(users);
});

router.get('/:id', async (req, res) => {
  const user = await UserModel.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.put('/:id', async (req, res) => {
  try {
    const updatedUser = await UserModel.update(req.params.id, req.body);
    res.json(updatedUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const deleted = await UserModel.delete(req.params.id);
  res.json({ deleted });
});

// Roster Management Routes
router.post('/roster/import/json', async (req, res) => {
  try {
    const result = await RosterService.importRosterFromJson(req.body);

    const statusCode = result.failed.length === 0 ? 200 : 207; // 207 Multi-Status if partial success
    res.status(statusCode).json({
      message: `Roster import completed: ${result.imported.length} imported, ${result.failed.length} failed`,
      imported_count: result.imported.length,
      failed_count: result.failed.length,
      total_processed: result.total,
      imported: result.imported,
      failed: result.failed,
    });
  } catch (error) {
    res.status(400).json({
      error: 'Roster import failed',
      message: error.message,
    });
  }
});

router.post('/roster/import/csv', upload.single('file'), async (req, res) => {
  try {
    let csvText;

    // Support multiple input methods: file upload, CSV in body, or raw text
    if (req.file) {
      csvText = req.file.buffer.toString('utf-8');
    } else if (req.body.csv && typeof req.body.csv === 'string') {
      csvText = req.body.csv;
    } else if (typeof req.body === 'string') {
      csvText = req.body;
    } else {
      return res.status(400).json({
        error: 'Invalid CSV input',
        message: 'Provide CSV file via multipart/form-data with field "file", or CSV text in request body',
      });
    }

    const result = await RosterService.importRosterFromCsv(csvText);

    const statusCode = result.failed.length === 0 ? 200 : 207; // 207 Multi-Status if partial success
    res.status(statusCode).json({
      message: `Roster import completed: ${result.imported.length} imported, ${result.failed.length} failed`,
      imported_count: result.imported.length,
      failed_count: result.failed.length,
      total_processed: result.total,
      imported: result.imported,
      failed: result.failed,
    });
  } catch (error) {
    res.status(400).json({
      error: 'Roster import failed',
      message: error.message,
    });
  }
});

router.get('/roster/export/json', async (req, res) => {
  try {
    const users = await RosterService.exportRosterToJson();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=roster.json');
    res.json(users);
  } catch (error) {
    res.status(500).json({
      error: 'Roster export failed',
      message: error.message,
    });
  }
});

router.get('/roster/export/csv', async (req, res) => {
  try {
    const csv = await RosterService.exportRosterToCsv();

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=roster.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({
      error: 'Roster export failed',
      message: error.message,
    });
  }
});

export default router;