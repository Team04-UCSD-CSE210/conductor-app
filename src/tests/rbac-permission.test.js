import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock function using vi.hoisted to ensure it's available during hoisting
const { mockHasPermission } = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
}));

// Mock PermissionService before any imports that use it
vi.mock('../services/permission-service.js', () => ({
  PermissionService: {
    hasPermission: mockHasPermission,
  },
}));

import { requirePermission } from '../middleware/permission-middleware.js';

describe('RBAC Permission Middleware', () => {
  beforeEach(() => {
    mockHasPermission.mockClear();
  });
  function makeReq(user = null) {
    return { user, currentUser: user, params: {}, body: {} };
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
    const fn = vi.fn(() => { fn.called = true; });
    fn.called = false;
    return fn;
  }

  it('should return 401 when no user is authenticated', async () => {
    const req = makeReq(null);
    const res = makeRes();
    const next = makeNext();

    const mw = requirePermission('roster.view', 'course');
    await mw(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when user lacks permission', async () => {
    mockHasPermission.mockResolvedValue(false);

    const req = makeReq({ id: 'u1' });
    const res = makeRes();
    const next = makeNext();

    const mw = requirePermission('roster.view', 'course');
    await mw(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next when user has permission', async () => {
    mockHasPermission.mockResolvedValue(true);

    const req = makeReq({ id: 'u1' });
    const res = makeRes();
    const next = makeNext();

    const mw = requirePermission('roster.view', 'course');
    await mw(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });
});