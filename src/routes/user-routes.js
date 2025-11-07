import { Router } from 'express';
import multer from 'multer';
import { UserModel } from '../models/user-model.js';
import { RosterService } from '../services/roster-service.js';
import { rosterImportLimiter } from '../middleware/rate-limiter.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: RosterService.MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    // Multer handles file size validation via limits, but we double-check
    if (req.file && req.file.size > RosterService.MAX_FILE_SIZE) {
      return cb(new Error('File size exceeds 10MB limit'));
    }
    cb(null, true);
  },
});

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
router.post('/roster/import/json', rosterImportLimiter, async (req, res) => {
  try {
    // Validate file size if content is large
    const contentSize = JSON.stringify(req.body).length;
    if (contentSize > RosterService.MAX_FILE_SIZE) {
      return res.status(400).json({
        error: 'File size exceeded',
        message: `File size (${(contentSize / 1024 / 1024).toFixed(2)}MB) exceeds 10MB limit`,
      });
    }

    const result = await RosterService.importRosterFromJson(req.body);

    // Check if CSV export is requested via query parameter
    if (req.query.export === 'csv' && result.imported.length > 0) {
      const csv = await RosterService.exportImportedUsersToCsv(result.imported);
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=imported-users-${timestamp}.csv`);
      return res.send(csv);
    }

    const statusCode = result.failed.length === 0 ? 200 : 207; // 207 Multi-Status if partial success
    res.status(statusCode).json({
      message: `Roster import completed: ${result.imported.length} imported, ${result.failed.length} failed`,
      imported_count: result.imported.length,
      failed_count: result.failed.length,
      total_processed: result.total,
      imported: result.imported,
      failed: result.failed,
      rollback_ids: result.importedIds, // Provide IDs for potential rollback
      export_csv_url: result.imported.length > 0 
        ? `/users/roster/export/imported/csv` 
        : null, // Provide endpoint to export CSV
    });
  } catch (error) {
    res.status(400).json({
      error: 'Roster import failed',
      message: error.message,
    });
  }
});

router.post('/roster/import/csv', rosterImportLimiter, upload.single('file'), async (req, res) => {
  try {
    let csvText;

    // Support multiple input methods: file upload, CSV in body, or raw text
    if (req.file) {
      // Validate file size
      if (req.file.size > RosterService.MAX_FILE_SIZE) {
        return res.status(400).json({
          error: 'File size exceeded',
          message: `File size (${(req.file.size / 1024 / 1024).toFixed(2)}MB) exceeds 10MB limit`,
        });
      }
      csvText = req.file.buffer.toString('utf-8');
    } else if (req.body.csv && typeof req.body.csv === 'string') {
      const csvSize = Buffer.byteLength(req.body.csv, 'utf8');
      if (csvSize > RosterService.MAX_FILE_SIZE) {
        return res.status(400).json({
          error: 'File size exceeded',
          message: `CSV size (${(csvSize / 1024 / 1024).toFixed(2)}MB) exceeds 10MB limit`,
        });
      }
      csvText = req.body.csv;
    } else if (typeof req.body === 'string') {
      const csvSize = Buffer.byteLength(req.body, 'utf8');
      if (csvSize > RosterService.MAX_FILE_SIZE) {
        return res.status(400).json({
          error: 'File size exceeded',
          message: `CSV size (${(csvSize / 1024 / 1024).toFixed(2)}MB) exceeds 10MB limit`,
        });
      }
      csvText = req.body;
    } else {
      return res.status(400).json({
        error: 'Invalid CSV input',
        message: 'Provide CSV file via multipart/form-data with field "file", or CSV text in request body',
      });
    }

    const result = await RosterService.importRosterFromCsv(csvText);

    // Check if CSV export is requested via query parameter
    if (req.query.export === 'csv' && result.imported.length > 0) {
      const csv = await RosterService.exportImportedUsersToCsv(result.imported);
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=imported-users-${timestamp}.csv`);
      return res.send(csv);
    }

    const statusCode = result.failed.length === 0 ? 200 : 207; // 207 Multi-Status if partial success
    res.status(statusCode).json({
      message: `Roster import completed: ${result.imported.length} imported, ${result.failed.length} failed`,
      imported_count: result.imported.length,
      failed_count: result.failed.length,
      total_processed: result.total,
      imported: result.imported,
      failed: result.failed,
      rollback_ids: result.importedIds, // Provide IDs for potential rollback
      export_csv_url: result.imported.length > 0 
        ? `/users/roster/export/imported/csv` 
        : null, // Provide endpoint to export CSV
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

// Export imported users as CSV
router.post('/roster/export/imported/csv', async (req, res) => {
  try {
    const { importedUsers } = req.body;

    if (!Array.isArray(importedUsers) || importedUsers.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'importedUsers must be a non-empty array',
      });
    }

    const csv = await RosterService.exportImportedUsersToCsv(importedUsers);

    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=imported-users-${timestamp}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({
      error: 'Export failed',
      message: error.message,
    });
  }
});

// Rollback endpoint for failed imports
router.post('/roster/rollback', async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        error: 'Invalid rollback request',
        message: 'userIds must be a non-empty array',
      });
    }

    const result = await RosterService.rollbackImport(userIds);

    res.status(200).json({
      message: `Rollback completed: ${result.rolledBack.length} users removed, ${result.failed.length} failed`,
      rolled_back_count: result.rolledBack.length,
      failed_count: result.failed.length,
      rolled_back: result.rolledBack,
      failed: result.failed,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Rollback failed',
      message: error.message,
    });
  }
});

export default router;