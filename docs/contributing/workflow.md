# Contributing Guide

Welcome! Thank you for contributing to Conductor.

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL 18 installed
- Git configured
- Code editor (VS Code recommended)

### Setup Development Environment

```powershell
# Clone repository
git clone https://github.com/Team04-UCSD-CSE210/conductor-app.git
cd conductor-app

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
notepad .env

# Initialize database
npm run db:setup

# Start development server
npm run dev
```

## Development Workflow

### 1. Create Feature Branch

```bash
# Update main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### 2. Make Changes

Follow our coding standards (see below).

### 3. Test Locally

```powershell
# Run all tests
npm test

# Run specific tests
npm run test:unit
npm run test:e2e
npm run lint
```

### 4. Commit Changes

Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git add .
git commit -m "feat: add user profile editing"
```

**Commit Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting (no logic changes)
- `refactor`: Code restructuring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

**Examples**:
```bash
git commit -m "feat: add email validation to user form"
git commit -m "fix: resolve session timeout bug"
git commit -m "docs: update API documentation for teams endpoint"
git commit -m "test: add unit tests for email validator"
git commit -m "refactor: extract authentication logic to middleware"
```

### 5. Push and Create Pull Request

```bash
# Push branch
git push origin feature/your-feature-name

# Go to GitHub and create Pull Request
```

### 6. Code Review

- Address reviewer comments
- Update PR as needed
- Ensure CI checks pass

### 7. Merge

After approval, maintainers will merge your PR.

## Code Standards

### JavaScript Style

**ESLint Configuration** (`.eslintrc.json`):
```json
{
  "extends": "@eslint/js/recommended",
  "env": {
    "node": true,
    "es2022": true,
    "browser": true
  },
  "rules": {
    "indent": ["error", 2],
    "quotes": ["error", "single"],
    "semi": ["error", "always"],
    "no-unused-vars": "error",
    "no-console": "off"
  }
}
```

**Best Practices**:
```javascript
// [OK] Good
const users = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
const user = users.rows[0];

if (!user) {
  return res.status(404).json({ error: 'User not found' });
}

res.json(user);

// [X] Bad
const users = await pool.query(`SELECT * FROM users WHERE id = '${userId}'`);
res.json(users.rows[0]);
```

**Function Documentation**:
```javascript
/**
 * Validates email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

### CSS Style

**Stylelint Configuration**:
- Use `stylelint-config-standard`
- Follow BEM naming convention
- Use CSS custom properties for theming

**Example**:
```css
/* [OK] Good */
.card {
  background-color: white;
  border-radius: 0.5rem;
  padding: 1rem;
}

.card__header {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.card--highlighted {
  border: 2px solid var(--palette-primary);
}

/* [X] Bad */
.Card {
  background-color: #ffffff;
  border-radius: 8px;
}
```

### HTML Standards

**HTMLHint Rules**:
- Use semantic HTML5 tags
- Include alt text for images
- Proper heading hierarchy
- ARIA attributes for accessibility

**Example**:
```html
<!-- [OK] Good -->
<article class="team-card">
  <header>
    <h2>Team 1</h2>
  </header>
  <section>
    <img src="/teams/team1.png" alt="Team 1 logo">
    <p>8 members</p>
  </section>
</article>

<!-- [X] Bad -->
<div class="team-card">
  <div class="header">Team 1</div>
  <img src="/teams/team1.png">
  <div>8 members</div>
</div>
```

### SQL Standards

**Naming Conventions**:
- Tables: `snake_case`, plural (`users`, `course_offerings`)
- Columns: `snake_case` (`user_id`, `created_at`)
- Indexes: `idx_table_column` (`idx_users_email`)
- Foreign keys: `fk_table_column` (`fk_enrollments_user_id`)

**Query Best Practices**:
```sql
-- [OK] Good: Parameterized, explicit columns
SELECT id, email, name, primary_role
FROM users
WHERE email = $1
  AND deleted_at IS NULL
LIMIT 50;

-- [X] Bad: SQL injection risk, SELECT *
SELECT *
FROM users
WHERE email = 'user@example.com';
```

**Migration File Format**:
```sql
-- Migration: XX-description.sql
-- Description: What this migration does
-- Date: YYYY-MM-DD

-- Create table
CREATE TABLE IF NOT EXISTS example_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index
CREATE INDEX idx_example_name ON example_table(name);

-- Insert seed data (if needed)
INSERT INTO example_table (name) VALUES ('Example');
```

## Testing Standards

### Unit Tests

**File Structure**:
- Test files: `tests/*.test.js`
- Match source file names
- One describe block per function

**Example**:
```javascript
import { describe, it, expect } from 'vitest';
import { validateEmail } from '../src/utils/validators.js';

describe('validateEmail', () => {
  it('should accept valid emails', () => {
    expect(validateEmail('user@ucsd.edu')).toBe(true);
  });
  
  it('should reject invalid emails', () => {
    expect(validateEmail('invalid')).toBe(false);
  });
  
  it('should handle edge cases', () => {
    expect(validateEmail(null)).toBe(false);
    expect(validateEmail('')).toBe(false);
  });
});
```

### E2E Tests

**File Structure**:
- Test files: `e2e/*.spec.js`
- Group by feature/workflow

**Example**:
```javascript
import { test, expect } from '@playwright/test';

test.describe('User Profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile.html');
  });
  
  test('should display user information', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Profile');
    await expect(page.locator('#user-email')).toBeVisible();
  });
  
  test('should update profile successfully', async ({ page }) => {
    await page.fill('#bio', 'Updated bio text');
    await page.click('button[type="submit"]');
    await expect(page.locator('.success-message')).toBeVisible();
  });
});
```

## Database Changes

### Creating Migrations

1. **Create Migration File**:
   ```bash
   # migrations/XX-your-migration-name.sql
   # XX = next sequential number
   ```

2. **Write Migration**:
   ```sql
   -- migrations/34-add-user-preferences.sql
   
   CREATE TABLE IF NOT EXISTS user_preferences (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     theme VARCHAR(50) DEFAULT 'light',
     notifications_enabled BOOLEAN DEFAULT true,
     created_at TIMESTAMP DEFAULT NOW(),
     UNIQUE(user_id)
   );
   
   CREATE INDEX idx_user_preferences_user_id 
   ON user_preferences(user_id);
   ```

3. **Test Locally**:
   ```powershell
   npm run db:migrate
   psql -U postgres -d conductor -c "SELECT * FROM user_preferences"
   ```

4. **Update Schema Documentation**:
   Update `docs/database/schema.md` with new table/columns.

### Rollback Migrations

Create rollback file if needed:
```sql
-- migrations/rollback/34-rollback-user-preferences.sql

DROP TABLE IF EXISTS user_preferences CASCADE;
```

## API Changes

### Adding New Endpoints

1. **Create Route File** (if needed):
   ```javascript
   // src/routes/preference-routes.js
   import express from 'express';
   import { pool } from '../db/pool.js';
   import { ensureAuthenticated } from '../middleware/auth.js';
   
   const router = express.Router();
   
   router.get('/', ensureAuthenticated, async (req, res) => {
     // Implementation
   });
   
   export default router;
   ```

2. **Register Route**:
   ```javascript
   // src/server.js
   import preferenceRoutes from './routes/preference-routes.js';
   app.use('/api/preferences', preferenceRoutes);
   ```

3. **Document API**:
   Update `docs/backend/api-reference.md`:
   ```markdown
   ### GET /api/preferences
   
   Get user preferences.
   
   **Auth**: Required
   **Response**: Preference object
   ```

4. **Add Tests**:
   ```javascript
   // e2e/api.spec.js
   test('GET /api/preferences returns user preferences', async ({ request }) => {
     const response = await request.get('/api/preferences');
     expect(response.ok()).toBeTruthy();
   });
   ```

## Documentation

### Update Documentation When:

- Adding new features
- Changing API endpoints
- Updating database schema
- Modifying deployment process
- Adding dependencies

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview |
| `docs/getting-started/` | Setup guides |
| `docs/backend/` | Backend documentation |
| `docs/frontend/` | Frontend documentation |
| `docs/database/` | Database documentation |
| `docs/testing/` | Testing guides |
| `docs/deployment/` | Deployment guides |

## Pull Request Guidelines

### PR Title

Use conventional commit format:
```
feat: add user preference settings
fix: resolve dashboard loading issue
docs: update database schema documentation
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
```

### Review Process

1. **Self-Review**: Review your own changes first
2. **Request Reviews**: Tag 1-2 team members
3. **Address Comments**: Respond to all review comments
4. **Update PR**: Push additional commits as needed
5. **Approval**: Wait for approval from reviewers
6. **Merge**: Maintainer merges after approval

## Common Tasks

### Adding a New Dashboard Feature

1. Create HTML page (`src/public/your-feature.html`)
2. Create CSS file (`src/public/css/your-feature.css`)
3. Create JS file (`src/public/js/your-feature.js`)
4. Add navigation link in relevant dashboards
5. Create API endpoint if needed
6. Add E2E tests
7. Update documentation

### Adding a Permission

1. Add permission to migrations:
   ```sql
   INSERT INTO permissions (scope, resource, action, code)
   VALUES ('course', 'assignment', 'manage', 'assignment.manage');
   ```
2. Map to roles:
   ```sql
   INSERT INTO enrollment_role_permissions (enrollment_role, permission_id)
   SELECT 'ta', id FROM permissions WHERE code = 'assignment.manage';
   ```
3. Use in route:
   ```javascript
   router.post('/', ...protect('assignment.manage', 'course'), handler);
   ```
4. Update `docs/backend/rbac.md`

## Getting Help

- **Slack**: #conductor-dev channel
- **GitHub Issues**: Create an issue for bugs/features
- **Documentation**: Check `docs/` folder first
- **Code Review**: Ask during PR review

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

---

**Thank you for contributing to Conductor!** 

