import { Router } from 'express';
import { ensureAuthenticated } from '../middleware/auth.js';
import { buildDiagnosticsSnapshot } from '../observability/collector.js';
import { pool } from '../db.js';

const router = Router();

// Restrict to authenticated users (admin only)
const authorizeDiagnostics = (req, res, next) => {
  const role = req.currentUser?.primary_role || req.user?.primary_role;
  if (!role || role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
};

router.get('/', ensureAuthenticated, authorizeDiagnostics, (req, res) => {
  const snapshot = buildDiagnosticsSnapshot();
  res.json(snapshot);
});

router.get('/history', ensureAuthenticated, authorizeDiagnostics, async (req, res) => {
  try {
    const { period, start, end } = req.query;
    const today = new Date();
    let startDate;
    let endDate = end ? new Date(end) : today;

    switch ((period || '').toUpperCase()) {
      case '1Y':
        startDate = new Date(endDate);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case '1W':
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '1M':
        startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '1D':
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'WTD': {
        startDate = new Date(endDate);
        const day = startDate.getDay(); // 0 Sun ... 6 Sat
        const offset = day === 0 ? 6 : day - 1; // Monday as start
        startDate.setDate(startDate.getDate() - offset);
        break;
      }
      case 'MTD': {
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        break;
      }
      case 'YTD': {
        startDate = new Date(endDate.getFullYear(), 0, 1);
        break;
      }
      default:
        startDate = start ? new Date(start) : new Date(endDate);
        break;
    }

    const rows = await pool.query(
      `SELECT snapshot_date, data, created_at
       FROM diagnostics_history
       WHERE snapshot_date BETWEEN $1::date AND $2::date
       ORDER BY snapshot_date ASC`,
      [startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)]
    );

    res.json({
      generated_at: new Date().toISOString(),
      start: startDate.toISOString().slice(0, 10),
      end: endDate.toISOString().slice(0, 10),
      entries: rows.rows,
    });
  } catch (err) {
    console.error('Failed to fetch diagnostics history:', err.message);
    res.status(500).json({ error: 'Failed to load diagnostics history' });
  }
});

export default router;
