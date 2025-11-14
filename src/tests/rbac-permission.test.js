import { requirePermission } from '../middleware/permission-middleware.js';
import * as PermissionService from '../services/permission-service.js';

// --- Mock helpers ---
const originalHasPermission = PermissionService.PermissionService.hasPermission;

function mockHasPermission(val) {
  PermissionService.PermissionService.hasPermission = async () => val;
}

function restoreHasPermission() {
  PermissionService.PermissionService.hasPermission = originalHasPermission;
}

// --- Test helpers ---
function makeReq(user = null) {
  return { user, params: {}, body: {} };
}

function makeRes() {
  const res = {};
  res.statusCode = 200;
  res.jsonData = null;

  res.status = function (code) {
    this.statusCode = code;
    return this;
  };
  res.json = function (data) {
    this.jsonData = data;
    return this;
  };
  return res;
}

function makeNext() {
  const fn = () => { fn.called = true; };
  fn.called = false;
  return fn;
}

// --- Tests ---
async function test401NoUser() {
  const req = makeReq(null);
  const res = makeRes();
  const next = makeNext();

  const mw = requirePermission('roster.view', 'course');
  await mw(req, res, next);

  console.log('test401NoUser:', res.statusCode === 401 ? 'OK' : 'FAIL');
}

async function test403NoPermission() {
  mockHasPermission(false);

  const req = makeReq({ id: 'u1' });
  const res = makeRes();
  const next = makeNext();

  const mw = requirePermission('roster.view', 'course');
  await mw(req, res, next);

  console.log('test403NoPermission:', res.statusCode === 403 ? 'OK' : 'FAIL');

  restoreHasPermission();
}

async function test200HasPermission() {
  mockHasPermission(true);

  const req = makeReq({ id: 'u1' });
  const res = makeRes();
  const next = makeNext();

  const mw = requirePermission('roster.view', 'course');
  await mw(req, res, next);

  const ok = next.called && res.statusCode === 200;
  console.log('test200HasPermission:', ok ? 'OK' : 'FAIL');

  restoreHasPermission();
}

// --- Runner ---
async function run() {
  await test401NoUser();
  await test403NoPermission();
  await test200HasPermission();
}

if (process.argv[1].includes('rbac-permission.test.js')) {
  run().catch(console.error);
}
