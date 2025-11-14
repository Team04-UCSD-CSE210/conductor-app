import { Router } from 'express';
import multer from 'multer';
import { UserService } from '../services/user-service.js';
import { RosterService } from '../services/roster-service.js';
import { rosterImportLimiter } from '../middleware/rate-limiter.js';
import { protectRole } from '../middleware/permission-middleware.js';

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

/**
 * Create a new user
 * POST /users
 * Body: { email, name, role, auth_source, ... }
 */
router.post('/', ...protectRole('admin', 'instructor'), async (req, res) => {
  try {
    // TODO: Get createdBy from auth middleware when authentication is implemented
    const createdBy = req.body.created_by || null;
    const newUser = await UserService.createUser(req.body, createdBy);
    res.status(201).json(newUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get all users with pagination
 * GET /users?limit=50&offset=0&includeDeleted=false
 */
router.get('/', async (req, res) => {
  try {
    const options = {
      limit: Number(req.query.limit ?? 50),
      offset: Number(req.query.offset ?? 0),
      includeDeleted: req.query.includeDeleted === 'true',
    };
    const result = await UserService.getUsers(options);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get user by ID
 * GET /users/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const user = await UserService.getUserById(req.params.id);
    res.json(user);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * Update user
 * PUT /users/:id
 * Body: { name, email, role, status, auth_source, ... }
 */
router.put('/:id', async (req, res) => {
  try {
    // TODO: Get updatedBy from auth middleware when authentication is implemented
    const updatedBy = req.body.updated_by || req.params.id; // Default to self-update
    const updatedUser = await UserService.updateUser(req.params.id, req.body, updatedBy);
    res.json(updatedUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Soft delete user
 * DELETE /users/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    // TODO: Get deletedBy from auth middleware when authentication is implemented
    const deletedBy = req.body.deleted_by || req.params.id; // Default to self-delete
    await UserService.deleteUser(req.params.id, deletedBy);
    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Restore soft-deleted user
 * POST /users/:id/restore
 */
router.post('/:id/restore', async (req, res) => {
  try {
    // TODO: Get restoredBy from auth middleware when authentication is implemented
    const restoredBy = req.body.restored_by || req.params.id;
    await UserService.restoreUser(req.params.id, restoredBy);
    res.json({ restored: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get users by primary_role
 * GET /users/role/:role?limit=50&offset=0
 */
router.get('/role/:role', async (req, res) => {
  try {
    const { role } = req.params;
    const options = {
      limit: Number(req.query.limit ?? 50),
      offset: Number(req.query.offset ?? 0),
    };
    const users = await UserService.getUsersByRole(role, options);
    res.json(users);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get users by institution_type (ucsd or extension)
 * GET /users/institution/:type?limit=50&offset=0
 */
router.get('/institution/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const options = {
      limit: Number(req.query.limit ?? 50),
      offset: Number(req.query.offset ?? 0),
    };
    const users = await UserService.getUsersByInstitutionType(type, options);
    res.json(users);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Import roster from JSON
 * POST /users/roster/import/json
 * Body: [{ email, name, primary_role, institution_type, ... }, ...]
 */
router.post(
  '/roster/import/json',
  ...protectRole('admin', 'instructor'),
  rosterImportLimiter,
  async (req, res) => {
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

      res.status(201).json({
        message: 'Roster imported successfully from JSON',
        imported_count: result.imported.length,
        failed_count: result.failed.length,
        imported: result.imported,
        failed: result.failed,
        rollback_ids: result.importedIds, // Provide IDs for potential rollback
        export_csv_url:
          result.imported.length > 0 ? `/users/roster/export/imported/csv` : null, // Provide endpoint to export CSV
      });
    } catch (error) {
      res.status(400).json({
        error: 'Roster import failed',
        message: error.message,
      });
    }
  }
);

/**
 * Import roster from CSV
 * POST /users/roster/import/csv
 * Supports file upload, CSV in body, or raw text
 */
router.post(
  '/roster/import/csv',
  ...protectRole('admin', 'instructor'),
  rosterImportLimiter,
  upload.single('file'),
  async (req, res) => {
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
            message: `File size (${(csvSize / 1024 / 1024).toFixed(2)}MB) exceeds 10MB limit`,
          });
        }
        csvText = req.body.csv;
      } else if (typeof req.body === 'string') {
        const bodySize = Buffer.byteLength(req.body, 'utf8');
        if (bodySize > RosterService.MAX_FILE_SIZE) {
          return res.status(400).json({
            error: 'File size exceeded',
            message: `File size (${(bodySize / 1024 / 1024).toFixed(2)}MB) exceeds 10MB limit`,
          });
        }
        csvText = req.body;
      } else {
        return res.status(400).json({
          error: 'No CSV provided',
          message:
            'Provide CSV content either as a file upload, in a "csv" field in the body, or as raw text',
        });
      }

      const result = await RosterService.importRosterFromCsv(csvText);

      res.status(201).json({
        message: 'Roster imported successfully from CSV',
        imported_count: result.imported.length,
        failed_count: result.failed.length,
        imported: result.imported,
        failed: result.failed,
      });
    } catch (error) {
      res.status(400).json({
        error: 'Roster import failed',
        message: error.message,
      });
    }
  }
);

/**
 * Export full roster as JSON
 * GET /users/roster/export/json
 */
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

/**
 * Export full roster as CSV
 * GET /users/roster/export/csv
 */
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

/**
 * Export imported users as CSV
 * POST /users/roster/export/imported/csv
 * Body: { importedUsers: [...] }
 */
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

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=imported_users.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({
      error: 'Export failed',
      message: error.message,
    });
  }
});

/**
 * Rollback imported users by IDs
 * POST /users/roster/rollback
 * Body: { userIds: [...] }
 */
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
