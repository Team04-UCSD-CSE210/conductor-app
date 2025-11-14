# Codebase Cleanup Plan

## 🔴 Critical Issues

### 1. **Duplicate Server Files**
- **`server.js`** (root) - Full OAuth/auth application with Sequelize (980 lines)
- **`src/server.js`** - Simple API server with pg Pool (32 lines)
- **Problem**: `package.json` points to `src/server.js`, but the main application is in root `server.js`
- **Action**: Decide which is the main server and remove/consolidate

### 2. **Duplicate Database Implementations**
- **`src/db.js`** - Uses `pg.Pool` (PostgreSQL connection pool)
- **`src/config/db.js`** - Uses `Sequelize` ORM
- **Problem**: Two different database access patterns in the same codebase
- **Action**: Choose one approach (Sequelize ORM vs raw SQL) and consolidate

### 3. **Dead/Unreachable Code in `server.js`**
- Lines 550-591: Duplicate/unreachable code blocks
  - Duplicate redirect logic (lines 550-562, 564-576, 581-591)
  - `startServer()` called twice (line 756 and 980)
- **Action**: Remove dead code blocks

### 4. **Inconsistent Model Usage**
- Root `server.js` defines `User` model inline (lines 94-105)
- But `src/models/user-model.js` exists and is not used
- **Action**: Use centralized models from `src/models/`

## 🟡 Medium Priority Issues

### 5. **Unused/Test Files**
- `dummy_login_test.js` - k6 load testing script (not used in production)
- Empty `config/` directory
- **Action**: Remove or move to `tests/` or `scripts/`

### 6. **Mixed Route Organization**
- Some routes inline in `server.js` (auth, OAuth, enrollment)
- Some routes in `src/routes/` (user-routes, enrollment-routes)
- **Action**: Move all routes to `src/routes/` for consistency

### 7. **Inconsistent Import Patterns**
- Some files use `dotenv/config`, others use `dotenv.config()`
- Mixed ES module patterns
- **Action**: Standardize import patterns

### 8. **Duplicate Dependencies**
- Both `pg` and `sequelize` in dependencies (though sequelize is in devDependencies)
- Both `sqlite3` and PostgreSQL - sqlite3 appears unused
- **Action**: Remove unused dependencies

## 🟢 Low Priority / Organization

### 9. **File Structure Inconsistencies**
- `src/database/init.js` exists but root `server.js` doesn't use it
- Services exist (`src/services/`) but not consistently used
- **Action**: Ensure all code uses centralized services

### 10. **Commented Code**
- Line 12 in `server.js`: `// import { trackLoginAttempt, isBlocked } from "./js/middleware/loginAttemptTracker.js";`
- **Action**: Remove commented imports

### 11. **Inconsistent Naming**
- Routes use both `.html` extensions and without (e.g., `/admin-dashboard` vs `/admin-dashboard.html`)
- **Action**: Standardize route naming

## 📋 Recommended Cleanup Steps

### Phase 1: Critical Fixes
1. ✅ Fix `package.json` JSON syntax (DONE)
2. **Decide on main server**: Choose between `server.js` or `src/server.js`
3. **Remove duplicate code** in `server.js` (lines 550-591, duplicate `startServer()`)
4. **Consolidate database layer**: Choose Sequelize OR pg Pool

### Phase 2: Architecture Cleanup
5. **Move routes to `src/routes/`**: Extract all routes from `server.js`
6. **Use centralized models**: Remove inline model definitions
7. **Standardize services**: Ensure all business logic uses `src/services/`

### Phase 3: Cleanup
8. **Remove unused files**: `dummy_login_test.js`, empty directories
9. **Remove unused dependencies**: `sqlite3` if not used
10. **Standardize imports**: Consistent dotenv usage

### Phase 4: Documentation
11. **Update README**: Document which server to use
12. **Add architecture notes**: Explain database choice

## 🎯 Quick Wins (Can do immediately)

1. Remove duplicate code blocks in `server.js` (lines 550-591)
2. Remove `dummy_login_test.js` if not needed
3. Remove empty `config/` directory
4. Remove commented imports
5. Fix duplicate `startServer()` call

## ⚠️ Decisions Needed

1. **Which server is the main one?**
   - Root `server.js` (OAuth/auth) - seems to be the main app
   - `src/server.js` (API only) - seems like a separate service

2. **Which database approach?**
   - Sequelize ORM (used in root server.js)
   - pg Pool (used in src/server.js and services)

3. **Should these be separate services?**
   - Auth server (OAuth, sessions)
   - API server (REST endpoints)

