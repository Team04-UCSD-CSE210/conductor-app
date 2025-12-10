# Authentication System

Complete guide to authentication in the Conductor application.

## Overview

Conductor uses **Google OAuth 2.0** for authentication with **session-based** state management.

```mermaid
flowchart LR
    A[User] -->|1. Click Login| B[/auth/google]
    B -->|2. Redirect| C[Google Login]
    C -->|3. Authorize| D[/auth/google/callback]
    D -->|4. Exchange Code| E[Google OAuth API]
    E -->|5. User Profile| F[Create/Find User]
    F -->|6. Set Session| G[Redirect to Dashboard]
    G -->|7. Authenticated| A
```

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| OAuth Provider | Google OAuth 2.0 | Identity provider |
| Strategy | Passport.js (passport-google-oauth20) | OAuth middleware |
| Session Store | express-session | Session management |
| Session Storage | MemoryStore (dev), Redis (prod) | Session persistence |
| Cookies | httpOnly, secure | Session token transport |

## Implementation

### 1. Google OAuth Setup

#### Configure OAuth Credentials

**Google Cloud Console**:
1. Create project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable Google+ API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URI: `http://localhost:8443/auth/google/callback`

**Environment Variables** (`.env`):
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:8443/auth/google/callback
```

#### Passport Strategy Configuration

`src/server.js`:
```javascript
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { pool } from './db/pool.js';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Extract profile data
    const email = profile.emails[0].value;
    const name = profile.displayName;
    const avatarUrl = profile.photos[0]?.value;
    const googleId = profile.id;
    
    // Find or create user
    let user = await findUserByEmail(email);
    
    if (!user) {
      user = await createUser({
        email,
        name,
        avatar_url: avatarUrl,
        google_id: googleId,
        primary_role: determineRole(email), // ucsd.edu = student
        status: 'active'
      });
    } else {
      // Update avatar if changed
      await updateUserAvatar(user.id, avatarUrl);
    }
    
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));
```

#### Serialize/Deserialize User

```javascript
passport.serializeUser((user, done) => {
  done(null, user.id); // Store only user ID in session
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    done(null, result.rows[0]);
  } catch (err) {
    done(err, null);
  }
});
```

### 2. Session Configuration

#### express-session Setup

```javascript
import session from 'express-session';

app.use(session({
  // Required: Session secret (must be random and secure)
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  
  // Don't save unchanged sessions
  resave: false,
  
  // Don't create session until something stored
  saveUninitialized: false,
  
  // Cookie configuration
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true, // Prevent XSS
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    sameSite: 'lax' // CSRF protection
  },
  
  // Production: Use Redis or database store
  // store: new RedisStore({ client: redisClient })
}));
```

#### Session Store Options

**Development** (default):
```javascript
// Uses MemoryStore (built-in)
// Pros: No setup required
// Cons: Sessions lost on restart, not suitable for production
```

**Production** (Redis):
```javascript
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});
redisClient.connect();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  // ... other options
}));
```

**Production** (PostgreSQL):
```javascript
import pgSession from 'connect-pg-simple';

const PgStore = pgSession(session);

app.use(session({
  store: new PgStore({
    pool: pool, // Use existing connection pool
    tableName: 'user_sessions'
  }),
  // ... other options
}));
```

### 3. Authentication Routes

`src/routes/auth-routes.js`:

```javascript
import express from 'express';
import passport from 'passport';

const router = express.Router();

// Initiate OAuth flow
router.get('/auth/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

// OAuth callback
router.get('/auth/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/login.html',
    failureMessage: true
  }),
  (req, res) => {
    // Success - redirect based on role
    const dashboardUrl = getDashboardForRole(req.user.primary_role);
    res.redirect(dashboardUrl);
  }
);

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Session destruction failed' });
      }
      res.clearCookie('connect.sid'); // Default session cookie name
      res.redirect('/login.html');
    });
  });
});

export default router;
```

### 4. Authentication Middleware

#### ensureAuthenticated

```javascript
export function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  
  // API request - return JSON error
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ 
      error: 'Authentication required',
      redirect: '/login.html'
    });
  }
  
  // Page request - redirect to login
  res.redirect('/login.html');
}
```

**Usage**:
```javascript
router.get('/api/user', ensureAuthenticated, async (req, res) => {
  res.json(req.user);
});
```

#### ensureRole

```javascript
export function ensureRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!allowedRoles.includes(req.user.primary_role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.primary_role
      });
    }
    
    next();
  };
}
```

**Usage**:
```javascript
router.get('/admin/users', ensureRole('admin'), async (req, res) => {
  // Only admins can access
});
```

## User Creation Flow

### Automatic User Creation

When a user logs in for the first time:

1. **Extract Email Domain**:
   ```javascript
   function determineRole(email) {
     if (email.endsWith('@ucsd.edu')) {
       return 'student'; // UCSD students
     } else {
       return 'unregistered'; // External users
     }
   }
   ```

2. **Determine Institution**:
   ```javascript
   function determineInstitution(email) {
     if (email.endsWith('@ucsd.edu')) {
       return 'ucsd';
     } else {
       return 'extension';
     }
   }
   ```

3. **Create User Record**:
   ```javascript
   async function createUser(profile) {
     const result = await pool.query(`
       INSERT INTO users (
         email, name, primary_role, status, institution_type,
         avatar_url, google_id, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *
     `, [
       profile.email,
       profile.name,
       profile.primary_role,
       'active',
       profile.institution_type,
       profile.avatar_url,
       profile.google_id
     ]);
     
     return result.rows[0];
   }
   ```

### Role Elevation

Users start with basic roles, then get elevated:

1. **Initial**: User logs in → `unregistered` or `student`
2. **Manual Promotion**: Admin updates `primary_role`:
   ```sql
   UPDATE users SET primary_role = 'instructor' WHERE id = 'xxx';
   ```
3. **Course Enrollment**: User enrolled with `course_role`:
   ```sql
   INSERT INTO enrollments (user_id, offering_id, course_role)
   VALUES ('xxx', 'yyy', 'ta');
   ```

## Security Features

### 1. Session Security

**HttpOnly Cookies**:
- Prevent JavaScript access to session cookie
- Mitigates XSS attacks

**Secure Flag**:
- HTTPS-only in production
- Prevents man-in-the-middle attacks

**SameSite**:
- `lax` - Cookies sent on same-site requests + top-level navigation
- Prevents CSRF attacks

### 2. Session Fixation Prevention

```javascript
passport.authenticate('google', {
  // ... options
})(req, res, () => {
  // Regenerate session ID after login
  req.session.regenerate((err) => {
    if (err) return next(err);
    
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) return next(err);
      res.redirect('/dashboard.html');
    });
  });
});
```

### 3. Rate Limiting

**Login Endpoint Protection**:
```javascript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

router.get('/auth/google', authLimiter, passport.authenticate('google'));
```

### 4. CSRF Protection

**Express Session CSRF**:
```javascript
import csurf from 'csurf';

const csrfProtection = csurf({ cookie: false }); // Use session

router.post('/api/users', csrfProtection, async (req, res) => {
  // CSRF token validated automatically
});
```

**Frontend Token Injection**:
```html
<input type="hidden" name="_csrf" value="<%= csrfToken %>">
```

### 5. Session Timeout

**Idle Timeout**:
```javascript
function checkSessionTimeout(req, res, next) {
  if (req.session.lastActivity) {
    const now = Date.now();
    const diff = now - req.session.lastActivity;
    const timeout = 30 * 60 * 1000; // 30 minutes
    
    if (diff > timeout) {
      return req.session.destroy(() => {
        res.status(401).json({ error: 'Session expired' });
      });
    }
  }
  
  req.session.lastActivity = Date.now();
  next();
}

app.use(checkSessionTimeout);
```

## Frontend Integration

### Login Page

`public/login.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <title>Conductor - Login</title>
</head>
<body>
  <div class="login-container">
    <h1>Welcome to Conductor</h1>
    <p>Course Management Platform for UCSD CSE 210</p>
    
    <a href="/auth/google" class="google-login-btn">
      <img src="/images/google-icon.svg" alt="Google">
      Sign in with Google
    </a>
    
    <p class="note">
      Use your UCSD email (@ucsd.edu) to access course features
    </p>
  </div>
</body>
</html>
```

### Check Authentication Status

`public/js/auth.js`:
```javascript
async function checkAuth() {
  try {
    const response = await fetch('/api/user');
    
    if (response.ok) {
      const user = await response.json();
      return user;
    } else if (response.status === 401) {
      // Not authenticated - redirect to login
      window.location.href = '/login.html';
    }
  } catch (err) {
    console.error('Auth check failed:', err);
    window.location.href = '/login.html';
  }
}

// Run on page load
document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (user) {
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-avatar').src = user.avatar_url;
  }
});
```

### Logout

```javascript
async function logout() {
  try {
    await fetch('/logout');
    window.location.href = '/login.html';
  } catch (err) {
    console.error('Logout failed:', err);
  }
}

document.getElementById('logout-btn').addEventListener('click', logout);
```

## Testing

### Manual Testing

1. **Login Flow**:
   - Navigate to `http://localhost:8443/login.html`
   - Click "Sign in with Google"
   - Authorize app
   - Should redirect to dashboard

2. **Session Persistence**:
   - After login, refresh page
   - Should remain authenticated
   - Check session cookie in DevTools

3. **Logout**:
   - Click logout button
   - Session should be destroyed
   - Should redirect to login page

### Automated Testing (Playwright)

```javascript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard.html');
    await expect(page).toHaveURL(/.*login\.html/);
  });
  
  test('should allow Google OAuth login', async ({ page }) => {
    // Note: Mocking OAuth in tests is complex
    // Better to use test users with pre-created sessions
    
    await page.goto('/login.html');
    await page.click('a[href="/auth/google"]');
    
    // Mock Google OAuth response (requires setup)
    // ...
    
    await expect(page).toHaveURL(/.*dashboard\.html/);
  });
  
  test('should logout successfully', async ({ page }) => {
    // Assume already logged in with session cookie
    await page.goto('/dashboard.html');
    
    await page.click('#logout-btn');
    await expect(page).toHaveURL(/.*login\.html/);
    
    // Verify session destroyed
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'connect.sid');
    expect(sessionCookie).toBeUndefined();
  });
});
```

## Troubleshooting

### Issue: "Unauthorized Redirect URI"

**Cause**: Callback URL not registered in Google Console

**Solution**:
1. Go to Google Cloud Console
2. Credentials → OAuth 2.0 Client IDs
3. Add `http://localhost:8443/auth/google/callback` to Authorized redirect URIs

### Issue: Session Lost on Server Restart

**Cause**: Using MemoryStore in development

**Solution**:
- Expected behavior in development
- Use Redis or database store in production

### Issue: "Session is undefined"

**Cause**: Session middleware not initialized before Passport

**Solution**:
```javascript
// Correct order:
app.use(session({ /* config */ }));
app.use(passport.initialize());
app.use(passport.session());
```

### Issue: User Not Deserializing

**Cause**: User deleted from database but session still active

**Solution**:
```javascript
passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    
    if (result.rows.length === 0) {
      // User deleted - invalidate session
      return done(null, false);
    }
    
    done(null, result.rows[0]);
  } catch (err) {
    done(err, null);
  }
});
```

## Production Checklist

- [ ] Use strong `SESSION_SECRET` (32+ random characters)
- [ ] Enable `secure: true` for cookies (HTTPS)
- [ ] Use Redis or database session store (not MemoryStore)
- [ ] Register production callback URL in Google Console
- [ ] Enable rate limiting on auth endpoints
- [ ] Implement session timeout
- [ ] Add CSRF protection for state-changing requests
- [ ] Monitor failed login attempts
- [ ] Set up session cleanup job (remove expired sessions)
- [ ] Configure proper CORS origins

---

**See Also:**
- [RBAC System](rbac.md)
- [API Reference](api-reference.md)
- [Backend Overview](overview.md)
- [Getting Started - Installation](../getting-started/installation.md)
