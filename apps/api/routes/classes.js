// apps/api/routes/classes.js
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const norm = (v) =>
  String(v ?? '')
    .normalize('NFC')
    .trim()
    .toUpperCase();


function toStringArray(maybeArr) {
  if (!Array.isArray(maybeArr)) return [];
  return maybeArr
    .map((x) => String(x ?? '').normalize('NFC').trim())
    .filter((s) => s.length > 0);
}


function getDataRoot(req) {

  const fromApp =
    (req?.app && typeof req.app.get === 'function' && req.app.get('DATA_DIR')) ||
    (req?.app?.locals && req.app.locals.DATA_DIR);

  const envRoot = process.env.API_DATA_DIR || process.env.DATA_DIR;

 
  if (!fromApp && !envRoot) {
    if (!req.app.locals.__AUTO_DATA_DIR) {
      req.app.locals.__AUTO_DATA_DIR = path.join(
        os.tmpdir(),
        `conductor_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      );
      fs.mkdirSync(req.app.locals.__AUTO_DATA_DIR, { recursive: true });
    }
    return req.app.locals.__AUTO_DATA_DIR;
  }

  return fromApp || envRoot || path.resolve(__dirname, '../data');
}



function getClassesPath(req) {
  const dataRoot = getDataRoot(req);
  fs.mkdirSync(dataRoot, { recursive: true });
  return path.join(dataRoot, 'classes.json');
}

function readClasses(req) {
  const classesPath = getClassesPath(req);
  try {
    const raw = fs.readFileSync(classesPath, 'utf-8');
    const data = JSON.parse(raw);
    const list = Array.isArray(data) ? data : [];
    return list.map((c) => ({
      code: String(c.code ?? '').normalize('NFC').trim(),
      title: String(c.title ?? '').normalize('NFC').trim(),
      instructor:
        typeof c.instructor === 'string'
          ? c.instructor.normalize('NFC').trim()
          : '',
      tags: toStringArray(c.tags),
    }));
  } catch {
    return [];
  }
}

function writeClasses(req, list) {
  const classesPath = getClassesPath(req);
  const safe = (list ?? []).map((c) => ({
    code: String(c.code ?? '').normalize('NFC').trim(),
    title: String(c.title ?? '').normalize('NFC').trim(),
    instructor:
      typeof c.instructor === 'string'
        ? c.instructor.normalize('NFC').trim()
        : '',
    tags: toStringArray(c.tags),
  }));
  fs.writeFileSync(classesPath, JSON.stringify(safe, null, 2), 'utf-8');
}


function findIndexByCode(list, code) {
  const needle = norm(code);
  return list.findIndex((c) => norm(c.code) === needle);
}


router.get('/classes', (req, res) => {
  let list = readClasses(req);


  const qRaw = String(req.query.q ?? '').normalize('NFC').trim();
  const branchesRaw = String(req.query.branches ?? '').normalize('NFC').trim();
  const tagRaw = String(req.query.tag ?? '').normalize('NFC').trim(); // 兼容旧参数
  const instructorRaw = String(req.query.instructor ?? '')
    .normalize('NFC')
    .trim();

  const q = qRaw.toLowerCase();
  const instructor = instructorRaw.toLowerCase();

  
  const branchTerms =
    branchesRaw || tagRaw
      ? (branchesRaw || tagRaw)
          .split(/[,\s]+/)
          .map((s) => s.toLowerCase())
          .filter(Boolean)
      : [];

  const hasQ = q.length > 0;
  const hasBranches = branchTerms.length > 0;
  const hasInstructor = instructor.length > 0;

  if (hasQ || hasBranches || hasInstructor) {
    list = list.filter((c) => {
      const code = String(c.code ?? '');
      const title = String(c.title ?? '');
      const instr = String(c.instructor ?? '');
      const tagsArr = Array.isArray(c.tags) ? c.tags : [];

      
      const lcCode = code.toLowerCase();
      const lcTitle = title.toLowerCase();
      const matchesQ = hasQ ? (lcTitle.includes(q) || lcCode.includes(q)) : false;

      const matchesBranches = hasBranches
        ? tagsArr.some((t) => {
            const lt = String(t).toLowerCase();
            return branchTerms.some(
              (term) => lt === term || lt.includes(term)
            );
          })
        : false;

      const matchesInstructor = hasInstructor
        ? instr.toLowerCase().includes(instructor)
        : false;

      
      return (
        (hasQ && matchesQ) ||
        (hasBranches && matchesBranches) ||
        (hasInstructor && matchesInstructor)
      );
    });
  }

  
  const hasPaging = 'page' in req.query || 'pageSize' in req.query;
  if (hasPaging) {
    const page = Number.parseInt(req.query.page ?? '1', 10);
    const pageSize = Number.parseInt(req.query.pageSize ?? '50', 10);
    const start = Math.max(0, (page - 1) * pageSize);
    const end = start + pageSize;
    return res.json(list.slice(start, end));
  }

  return res.json(list);
});


router.get('/classes/:code', (req, res) => {
  const codeParam = decodeURIComponent(String(req.params.code ?? ''))
    .normalize('NFC')
    .trim();

  const list = readClasses(req);
  const idx = findIndexByCode(list, codeParam);
  if (idx === -1)
    return res.status(404).json({ error: true, message: 'class not found' });
  return res.json(list[idx]);
});


router.post('/classes', (req, res) => {
  const body = req.body ?? {};
  const codeRaw = String(body.code ?? '').normalize('NFC').trim();
  const title = String(body.title ?? '').normalize('NFC').trim();

  if (!codeRaw || !title) {
    return res
      .status(400)
      .json({ error: true, message: 'code and title are required' });
  }

  const list = readClasses(req);
  if (findIndexByCode(list, codeRaw) !== -1) {
    return res
      .status(409)
      .json({ error: true, message: 'class code already exists' });
  }

  const item = {
    code: codeRaw, 
    title,
    instructor:
      typeof body.instructor === 'string'
        ? body.instructor.normalize('NFC').trim()
        : '',
    tags: toStringArray(body.tags),
  };

  list.push(item);
  writeClasses(req, list);
  return res.status(201).json(item);
});


router.put('/classes/:code', (req, res) => {
  const codeParam = decodeURIComponent(String(req.params.code ?? ''))
    .normalize('NFC')
    .trim();

  const list = readClasses(req);
  const idx = findIndexByCode(list, codeParam);
  if (idx === -1)
    return res.status(404).json({ error: true, message: 'class not found' });

  const cur = { ...list[idx] };
  const { title, instructor, tags } = req.body ?? {};

  if (typeof title === 'string') cur.title = title.normalize('NFC').trim();
  if (typeof instructor === 'string')
    cur.instructor = instructor.normalize('NFC').trim();
  if (Array.isArray(tags)) cur.tags = toStringArray(tags);

  list[idx] = cur;
  writeClasses(req, list);
  return res.json(cur);
});


router.delete('/classes/:code', (req, res) => {
  const codeParam = decodeURIComponent(String(req.params.code ?? ''))
    .normalize('NFC')
    .trim();

  let list = readClasses(req);
  let idx = findIndexByCode(list, codeParam);

  if (idx === -1) {
    
    list = readClasses(req);
    idx = findIndexByCode(list, codeParam);
  }

  if (idx === -1) {
    return res
      .status(404)
      .json({ error: true, message: 'class not found' });
  }

  const removed = list[idx];
  list.splice(idx, 1);
  writeClasses(req, list);
  return res.json(removed);
});

export default router;
