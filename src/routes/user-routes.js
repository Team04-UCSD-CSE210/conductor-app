import { Router } from 'express';
import multer from 'multer';
import { UserModel } from '../models/user-model.js';
import { RosterService } from '../services/roster-service.js';
import { rosterImportLimiter } from '../middleware/rate-limiter.js';
import { authenticate, requirePermission, requireRole } from '../middleware/auth-middleware.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

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

router.post('/', 
  requirePermission('edit_students', { requireCourse: false }),
  async (req, res) => {
    try {
      const newUser = await UserModel.create(req.body);
      res.status(201).json(newUser);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.get('/', 
  requirePermission('view_students', { requireCourse: false }),
  async (req, res) => {
    try {
      const { limit = 50, offset = 0, email } = req.query;
      
      // If searching by email, use findByEmail
      if (email) {
        const user = await UserModel.findByEmail(email);
        return res.json({ users: user ? [user] : [] });
      }
      
      const users = await UserModel.findAll(Number(limit), Number(offset));
      res.json({ users });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get('/:id', async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Users can view their own profile, others need permission
    if (req.params.id !== req.user.id) {
      // Check if user has view_students permission in any course (simplified)
      // In production, you might want more granular checks
      if (req.user.system_role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', 
  requirePermission('edit_students', { requireCourse: false }),
  async (req, res) => {
    try {
      const updatedUser = await UserModel.update(req.params.id, req.body);
      res.json(updatedUser);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.delete('/:id', 
  requirePermission('edit_students', { requireCourse: false }),
  async (req, res) => {
    try {
      const deleted = await UserModel.delete(req.params.id);
      res.json({ deleted });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Roster Management Routes - Require professor or TA role
router.post('/roster/import/json', 
  rosterImportLimiter,
  requireRole(['professor', 'ta'], { requireCourse: false }),
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

      const statusCode = result.failed.length === 0 ? 200 : 207; // 207 Multi-Status if partial success
      res.status(statusCode).json({
        message: `Roster import completed: ${result.imported.length} imported, ${result.failed.length} failed`,
        imported_count: result.imported.length,
        failed_count: result.failed.length,
        total_processed: result.total,
        imported: result.imported,
        failed: result.failed,
        rollback_ids: result.importedIds, // Provide IDs for potential rollback
      });
    } catch (error) {
      res.status(400).json({
        error: 'Roster import failed',
        message: error.message,
      });
    }
  }
);

router.post('/roster/import/csv', 
  rosterImportLimiter, 
  requireRole(['professor', 'ta'], { requireCourse: false }),
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

      const statusCode = result.failed.length === 0 ? 200 : 207; // 207 Multi-Status if partial success
      res.status(statusCode).json({
        message: `Roster import completed: ${result.imported.length} imported, ${result.failed.length} failed`,
        imported_count: result.imported.length,
        failed_count: result.failed.length,
        total_processed: result.total,
        imported: result.imported,
        failed: result.failed,
        rollback_ids: result.importedIds, // Provide IDs for potential rollback
      });
    } catch (error) {
      res.status(400).json({
        error: 'Roster import failed',
        message: error.message,
      });
    }
  }
);

router.get('/roster/export/json', 
  requireRole(['professor', 'ta'], { requireCourse: false }),
  async (req, res) => {
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
  }
);

router.get('/roster/export/csv', 
  requireRole(['professor', 'ta'], { requireCourse: false }),
  async (req, res) => {
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
  }
);

// Rollback endpoint for failed imports
router.post('/roster/rollback', 
  requireRole(['professor', 'ta'], { requireCourse: false }),
  async (req, res) => {
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
  }
);

export default router;