import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import path from "path";
import https from "https";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
// import { createClient } from "redis";
// import { RedisStore } from "connect-redis";
import { pool } from "./db.js";
import { DatabaseInitializer } from "./database/init.js";
import bodyParser from "body-parser";
import crypto from "crypto";
import { ensureAuthenticated } from "./middleware/auth.js";
import { protect, protectAny } from "./middleware/permission-middleware.js";
import userRoutes from "./routes/user-routes.js";
import enrollmentRoutes from "./routes/enrollment-routes.js";
import teamRoutes from "./routes/team-routes.js";
import offeringRoutes from "./routes/offering-routes.js";
import interactionRoutes from "./routes/interaction-routes.js";
import courseOfferingRoutes from "./routes/class-routes.js";
import sessionRoutes from "./routes/session-routes.js";
import attendanceRoutes from "./routes/attendance-routes.js";
import journalRoutes from "./routes/journal-routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Since server.js is in src/, views are in src/views relative to project root, but "views" relative to src/
const VIEW_DIR = process.env.VERCEL ? "public" : "views"

dotenv.config();

// SSL certificate and key (optional for local dev)
let sslOptions = null;
let HTTPS_AVAILABLE = false;
try {
  // Certs are in project root, so go up one level from src/
  const keyPath = path.join(__dirname, "..", "certs", "server.key");
  const certPath = path.join(__dirname, "..", "certs", "server.crt");
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    sslOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    HTTPS_AVAILABLE = true;
  } else {
    console.warn("⚠️ SSL cert/key not found in ./certs — falling back to HTTP for local dev. To enable HTTPS, place server.key and server.crt in the certs/ directory or generate self-signed certs.");
  }
} catch (err) {
  console.error("Error reading SSL certs, falling back to HTTP:", err);
  sslOptions = null;
  HTTPS_AVAILABLE = false;
}

const app = express();

// Disable ETag generation to prevent 304 caching issues
app.set('etag', false);

// Serve static frontend assets
// Since server.js is in src/, paths are relative to src/ directory
app.use(express.static(path.join(__dirname, "views")));
app.use(express.static(path.join(__dirname, "public")));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// -------------------- CONFIG --------------------
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || "https://localhost:8443/auth/google/callback";
const DATABASE_URL = process.env.DATABASE_URL;
const ALLOWED_DOMAIN = process.env.ALLOWED_GOOGLE_DOMAIN || "ucsd.edu";
// const REDIS_URL = process.env.REDIS_URL;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const LOGIN_FAILURE_THRESHOLD = parsePositiveInt(process.env.LOGIN_FAILURE_THRESHOLD, 3);
const LOGIN_FAILURE_WINDOW_MINUTES = parsePositiveInt(process.env.LOGIN_FAILURE_WINDOW_MINUTES, 15);
const LOGIN_FAILURE_WINDOW_MS = LOGIN_FAILURE_WINDOW_MINUTES * 60 * 1000;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing Google OAuth credentials. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment.");
  process.exit(1);
}

if (!SESSION_SECRET) {
  console.error("Missing SESSION_SECRET. Set SESSION_SECRET in your environment for secure session handling.");
  process.exit(1);
}

// Session middleware MUST come early in middleware stack
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());

// Custom wrapper for passport.session() to handle missing sessions gracefully
app.use((req, res, next) => {
  // Only run passport.session() if session exists
  if (req.session) {
    return passport.session()(req, res, next);
  }
  // If no session, just continue (for static files, etc.)
  next();
});

if (!DATABASE_URL || DATABASE_URL.includes("localhost")) {
  console.log("⚠️ Database not configured or using localhost, running without database features");
} else {
  // Database connection logic would go here when needed
}

// Database helper functions using pg Pool

// User operations
const findUserByEmail = async (email) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Database query error:', error.message);
    return null;
  }
};

const findOrCreateUser = async (email, defaults = {}) => {
  try {
    let user = await findUserByEmail(email);
    
    if (!user) {
      // Simple user creation with primary_role defaulting to 'unregistered'
      const result = await pool.query(
        `INSERT INTO users (email, name, primary_role) VALUES ($1, $2, $3) 
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name 
         RETURNING *`,
        [
          email,
          defaults.name || email.split('@')[0],
          defaults.primary_role || 'unregistered'
        ]
      );
      user = result.rows[0];
    }
    
    return user;
  } catch (error) {
    console.error('Error in findOrCreateUser:', error.message);
    // Return a mock user object to prevent auth failure
    return {
      id: 1,
      email: email,
      name: defaults.name || email.split('@')[0],
      primary_role: 'unregistered'
    };
  }
};

const updateUserRole = async (email, primaryRole) => {
  const validRoles = ['admin', 'instructor', 'student', 'unregistered'];
  if (!validRoles.includes(primaryRole)) {
    throw new Error(`Invalid primary_role. Must be one of: ${validRoles.join(', ')}`);
  }
  
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(`User with email ${email} not found`);
  }
  
  try {
    await pool.query(
      'UPDATE users SET primary_role = $1 WHERE email = $2',
      [primaryRole, email]
    );
  } catch (error) {
    console.error('Error updating user role:', error.message);
    return;
  }
  
  // Auto-enroll students in the active course offering
  if (primaryRole === 'student') {
    const offering = await getActiveCourseOffering();
    if (offering) {
      await enrollUserInCourse(user.id, offering.id, 'student');
      console.log(`✅ Auto-enrolled ${email} as student in offering ${offering.id}`);
    } else {
      console.warn(`⚠️ No active course offering found - student ${email} was not auto-enrolled`);
    }
  }
};

// Get the single active course offering
const getActiveCourseOffering = async () => {
  const result = await pool.query(
    'SELECT * FROM course_offerings WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1'
  );
  return result.rows[0] || null;
};

// Auto-enroll user in the single course offering
const enrollUserInCourse = async (userId, offeringId, courseRole = 'student') => {
  try {
    await pool.query(
      `INSERT INTO enrollments (offering_id, user_id, course_role, status, enrolled_at)
       VALUES ($1, $2, $3::enrollment_role_enum, 'enrolled'::enrollment_status_enum, CURRENT_DATE)
       ON CONFLICT (offering_id, user_id) DO NOTHING`,
      [offeringId, userId, courseRole]
    );
  } catch (error) {
    console.error('Failed to enroll user in course:', error);
    // Don't throw - enrollment is optional
  }
};

// Get user's enrollment role for dashboard routing (uses active course offering)
const getUserEnrollmentRole = async (userId) => {
  const offering = await getActiveCourseOffering();
  if (!offering) return null;
  
  const result = await pool.query(
    `SELECT course_role FROM enrollments 
     WHERE offering_id = $1 AND user_id = $2 AND status = 'enrolled'::enrollment_status_enum
     LIMIT 1`,
    [offering.id, userId]
  );
  return result.rows[0]?.course_role || null;
};

// Check if user is a team lead in the active course offering
const isUserTeamLead = async (userId) => {
  const offering = await getActiveCourseOffering();
  if (!offering) return false;
  
  // First check if user has enrollment role 'team-lead'
  const enrollmentCheck = await pool.query(
    `SELECT 1 FROM enrollments 
     WHERE user_id = $1 AND offering_id = $2 
       AND course_role = 'team-lead'::enrollment_role_enum 
       AND status = 'enrolled'::enrollment_status_enum
     LIMIT 1`,
    [userId, offering.id]
  );
  
  if (enrollmentCheck.rows.length > 0) {
    return true;
  }
  
  // Otherwise check if user is a team leader
  const result = await pool.query(
    `SELECT t.id, t.leader_id, tm.role
     FROM team t
     LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.user_id = $1 AND tm.left_at IS NULL
     WHERE t.offering_id = $2 
       AND (t.leader_id = $1 OR tm.role = 'leader'::team_member_role_enum)
     LIMIT 1`,
    [userId, offering.id]
  );
  // User is a team lead if they are the leader_id OR have role='leader' in team_members
  return result.rows.length > 0 && 
    (result.rows[0].leader_id === userId || result.rows[0].role === 'leader');
};

// Note: getUserEnrollmentRoleForOffering functionality is available in src/middleware/auth.js
// as getUserEnrollmentRole(userId, offeringId) - no need to duplicate here

const safeLogout = (req, callback = () => {}) => {
  if (typeof req.logout === "function" && req.session) {
    req.logout(callback);
    return;
  }
  // Clear any lingering user data when session is already gone
  if (req.user) req.user = null;
  if (req.session && req.session.passport) {
    delete req.session.passport;
  }
  callback();
};

const safeDestroySession = (req, callback = () => {}) => {
  if (req.session && typeof req.session.destroy === "function") {
    req.session.destroy(callback);
  } else {
    callback();
  }
};

// Whitelist operations
const findWhitelistEntry = async (email) => {
  const result = await pool.query('SELECT * FROM whitelist WHERE email = $1', [email]);
  return result.rows[0] || null;
};

const findOrCreateWhitelist = async (email, approvedBy = "Admin") => {
  let entry = await findWhitelistEntry(email);
  if (!entry) {
    const result = await pool.query(
      'INSERT INTO whitelist (email, approved_by) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING *',
      [email, approvedBy]
    );
    entry = result.rows[0] || await findWhitelistEntry(email);
  }
  return entry;
};

// Access request operations
const findAccessRequest = async (email) => {
  const result = await pool.query('SELECT * FROM access_requests WHERE email = $1', [email]);
  return result.rows[0] || null;
};

const createAccessRequest = async (email, reason) => {
  await pool.query(
    'INSERT INTO access_requests (email, reason) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET reason = EXCLUDED.reason, requested_at = NOW()',
    [email, reason]
  );
};

const updateAccessRequest = async (email, reason) => {
  await pool.query(
    'UPDATE access_requests SET reason = $1, requested_at = NOW() WHERE email = $2',
    [reason, email]
  );
};

const deleteAccessRequest = async (email) => {
  await pool.query('DELETE FROM access_requests WHERE email = $1', [email]);
};

const getAllAccessRequests = async () => {
  const result = await pool.query('SELECT * FROM access_requests ORDER BY requested_at DESC');
  return result.rows;
};

const getAllWhitelist = async () => {
  const result = await pool.query('SELECT * FROM whitelist ORDER BY approved_at DESC');
  return result.rows;
};

let redisClient = null;
let redisConnected = false;

// Redis completely disabled
console.log("⚠️ Redis disabled, running without Redis");

const extractIpAddress = (req) => {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req?.socket?.remoteAddress || null;
};

const logAuthEvent = async (eventType, { req, message, userEmail, metadata } = {}) => {
  try {
    await pool.query(
      `INSERT INTO auth_logs (event_type, message, user_email, ip_address, path, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        eventType,
        message || null,
        userEmail || req?.user?.emails?.[0]?.value || req?.user?.email || null,
        req ? extractIpAddress(req) : null,
        req?.originalUrl || null,
        metadata ? JSON.stringify(metadata) : '{}'
      ]
    );
  } catch (error) {
    console.error("Failed to persist auth log", error.message);
  }
};

const LOGIN_ATTEMPT_KEY_PREFIX = "login_attempts:";

const getLoginIdentifier = (email, req) => {
  if (email) {
    return `user:${email.toLowerCase()}`;
  }
  const ip = extractIpAddress(req);
  if (ip) {
    return `ip:${ip}`;
  }
  return null;
};

const getLoginAttemptKey = (identifier) => `${LOGIN_ATTEMPT_KEY_PREFIX}${identifier}`;

const getLoginAttemptStatus = async (identifier) => {
  if (!identifier || !redisClient || !redisConnected) {
    return { attempts: 0, blocked: false };
  }
  try {
    const rawAttempts = await redisClient.get(getLoginAttemptKey(identifier));
    const attempts = rawAttempts ? Number.parseInt(rawAttempts, 10) : 0;
    if (Number.isNaN(attempts)) {
      return { attempts: 0, blocked: false };
    }
    return {
      attempts,
      blocked: attempts >= LOGIN_FAILURE_THRESHOLD
    };
  } catch (error) {
    console.error("Unable to read login attempt count", error);
    return { attempts: 0, blocked: false };
  }
};

const recordFailedLoginAttempt = async (identifier) => {
  if (!identifier || !redisClient || !redisConnected) return 0;
  try {
    const key = getLoginAttemptKey(identifier);
    const attempts = await redisClient.incr(key);
    if (attempts === 1) {
      await redisClient.pexpire(key, LOGIN_FAILURE_WINDOW_MS);
    }
    return attempts;
  } catch (error) {
    console.error("Unable to record failed login attempt", error);
    return 0;
  }
};

const clearLoginAttempts = async (identifier) => {
  if (!identifier || !redisClient || !redisConnected) return;
  try {
    await redisClient.del(getLoginAttemptKey(identifier));
  } catch (error) {
    console.error("Unable to clear login attempts", error);
  }
};

// ensureAuthenticated is imported from middleware/auth.js
// If auth event logging is needed for specific routes, it can be added as a wrapper

// -------------------- PASSPORT --------------------
passport.use(new GoogleStrategy({
  clientID: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  callbackURL: CALLBACK_URL,
  passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
  const email = profile?.emails?.[0]?.value || null;
  const domain = profile?._json?.hd || null;
  const userId = profile?.id || null;
  const identifier = getLoginIdentifier(email, req);
  
  // Debug logging
  console.log(`[DEBUG] OAuth callback - email: ${email}, domain (hd): ${domain}, ALLOWED_DOMAIN: ${ALLOWED_DOMAIN}`);
  
  // --- UCSD emails bypass whitelist check entirely ---
  // Check both Google's hosted domain (hd) and email domain as fallback
  const isUCSDEmail = domain === ALLOWED_DOMAIN || email?.toLowerCase().endsWith('@ucsd.edu');
  console.log(`[DEBUG] Is UCSD email: ${isUCSDEmail} (domain match: ${domain === ALLOWED_DOMAIN}, email match: ${email?.toLowerCase().endsWith('@ucsd.edu')})`);
  
  // --- UCSD users bypass rate limiting ---
  if (isUCSDEmail) {
    await clearLoginAttempts(identifier);
    console.log(`🔐 UCSD user detected: ${email}, bypassing rate limits`);
  }
  
  const { blocked, attempts: recentAttempts } = await getLoginAttemptStatus(identifier);

  // --- Whitelist bypass for rate limits (only for non-UCSD emails) ---
  if (email && !isUCSDEmail) {
    const whitelistEntry = await findWhitelistEntry(email);
    if (whitelistEntry) {
      console.log(`[TRACE] Whitelisted user bypassing rate-limit: ${email}`);
      await clearLoginAttempts(identifier);
      await logAuthEvent("LOGIN_SUCCESS_WHITELIST_BYPASS", {
        req,
        message: "Whitelisted user bypassed rate-limit",
        userEmail: email,
        userId,
        metadata: { provider: "google" }
      });
      return done(null, profile);
    }
  }

  console.log(`🔐 Login attempt for email: ${email}. Blocked: ${blocked}. Recent attempts: ${recentAttempts}. Is UCSD: ${isUCSDEmail}`);
  // Only block non-UCSD users from rate limiting
  if (blocked && !isUCSDEmail) {
    await logAuthEvent("LOGIN_RATE_LIMITED", {
      req,
      message: "Login blocked due to too many failed attempts.",
      userEmail: email,
      userId,
      metadata: {
        provider: "google",
        domain,
        attempts: recentAttempts,
        threshold: LOGIN_FAILURE_THRESHOLD,
        windowMinutes: LOGIN_FAILURE_WINDOW_MINUTES
      }
    });
    return done(null, false, { message: "Too many failed login attempts. Please try again later." });
  }

  try {
    // --- Step 1: UCSD domain always allowed ---
    // Check both domain from Google (hd) and email domain as fallback
    const isUCSDDomain = domain === ALLOWED_DOMAIN || email?.toLowerCase().endsWith('@ucsd.edu');
    
    if (isUCSDDomain) {
      console.log(`🔐 UCSD domain login successful email: ${email} (domain: ${domain || 'from email'})`);
      console.log(`[DEBUG] About to return done(null, profile) for UCSD user`);
      try {
        await clearLoginAttempts(identifier);
        await logAuthEvent("LOGIN_SUCCESS", {
          req,
          message: "Google OAuth login succeeded (UCSD domain)",
          userEmail: email,
          userId,
          metadata: { provider: "google", domain: domain || "detected from email" }
        });
      } catch (error) {
        console.error("Error in UCSD auth logging (non-critical):", error.message);
      }
      console.log(`[DEBUG] Calling done(null, profile) for UCSD user ${email}`);
      return done(null, profile);
    }

    // --- Step 2: Non-UCSD (gmail etc.) → check whitelist ---
    console.log(`🔐 Non-UCSD domain login successful email: ${email}`);
    if (email) {
      console.log(`[TRACE] Checking whitelist for email: ${email}`);
      const whitelistEntry = await findWhitelistEntry(email);
      if (whitelistEntry) {
        console.log(`[TRACE] Whitelist entry found for email: ${email}`);
        await clearLoginAttempts(identifier);
        await logAuthEvent("LOGIN_SUCCESS_WHITELIST", {
          req,
          message: "Whitelisted non-UCSD user allowed login",
          userEmail: email,
          userId,
          metadata: { provider: "google" }
        });

        // ✅ Whitelisted users should be created as 'unregistered' on first login
        // They will be redirected to register.html to choose their role
        console.log(`[TRACE] Creating or finding whitelisted user for email: ${email}`);
        await findOrCreateUser(email, {
          name: profile.displayName,
          primary_role: 'unregistered', // Whitelisted users start as unregistered, just like UCSD users
          google_id: userId
        });

        console.log(`[TRACE] Login successful for whitelisted user: ${email}`);
        return done(null, profile);
      } else {
        console.log(`[TRACE] No whitelist entry for email: ${email}`);
      }
    }

    // --- Step 3: All others → block and log ---
    const attempts = await recordFailedLoginAttempt(identifier);
    await logAuthEvent("LOGIN_REJECTED_DOMAIN", {
      req,
      message: `Attempted login from unauthorized domain: ${domain || "unknown"}`,
      userEmail: email,
      userId,
      metadata: {
        provider: "google",
        domain,
        attempts,
        threshold: LOGIN_FAILURE_THRESHOLD,
        windowMinutes: LOGIN_FAILURE_WINDOW_MINUTES
      }
    });
    // Store email in session before redirect so /auth/failure can access it
    if (req.session && email) {
      req.session.userEmail = email;
    }
    return done(null, false, { message: "Non-UCSD or unapproved account" });
  } catch (error) {
    console.error("Error during Google OAuth verification", error);
    const attempts = await recordFailedLoginAttempt(identifier);
    await logAuthEvent("LOGIN_ERROR", {
      req,
      message: "Error encountered during OAuth verification",
      userEmail: email,
      userId,
      metadata: {
        provider: "google",
        domain,
        error: error.message,
        attempts,
        threshold: LOGIN_FAILURE_THRESHOLD,
        windowMinutes: LOGIN_FAILURE_WINDOW_MINUTES
      }
    });
    // Store email in session before redirect so /auth/failure can access it
    if (req.session && email) {
      req.session.userEmail = email;
    }
    return done(error);
  }
}));

console.log("✅ OAuth callback configured for:", CALLBACK_URL);


passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// -------------------- MIDDLEWARE --------------------

// Test route to verify sessions work
app.get("/test-session", (req, res) => {
  if (!req.session) {
    return res.status(500).send("Session not available");
  }
  req.session.test = "Session working!";
  res.send("Session test passed");
});

// Root route
app.get("/", (req, res) => {
  res.send('<h1>Conductor App</h1><a href="/login">Login</a>');
});

// Parse JSON and URL-encoded request bodies (must be before API routes)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Dashboard routing - redirects to role-specific dashboard
app.get("/dashboard", ensureAuthenticated, async (req, res) => {
  try {
    const email = req.user?.emails?.[0]?.value;
    if (!email) {
      return res.redirect("/login");
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.redirect("/login");
    }

    // Get enrollment role for TA/student routing
    const enrollmentRole = await getUserEnrollmentRole(user.id);
    
    // Route based on primary_role and enrollment role
    if (user.primary_role === 'admin') {
      return res.redirect("/admin-dashboard");
    }
    
    if (user.primary_role === 'instructor') {
      return res.redirect("/instructor-dashboard");
    }
    
    // TA role comes from enrollments.course_role
    if (enrollmentRole === 'ta' || enrollmentRole === 'tutor') {
      return res.redirect("/ta-dashboard");
    }
    
    // Check if user is a team lead - team leads get special dashboard
    const isTeamLead = await isUserTeamLead(user.id);
    if (isTeamLead && (enrollmentRole === 'student' || user.primary_role === 'student')) {
      return res.redirect("/team-lead-dashboard");
    }
    
    // Students and unregistered users
    if (enrollmentRole === 'student' || user.primary_role === 'student') {
      return res.redirect("/student-dashboard");
    }
    
    // Unregistered users not in roster - show error
    if (user.primary_role === 'unregistered') {
      req.session.notInRosterEmail = user.email;
      return res.redirect("/not-in-roster.html");
    }
    
    // Default fallback - not in roster
    req.session.notInRosterEmail = user.email;
    return res.redirect("/not-in-roster.html");
  } catch (error) {
    console.error("Error in /dashboard routing:", error);
    return res.redirect("/login");
  }
});

// Role-based dashboards with permission-based access control
app.get("/admin-dashboard", ...protect('user.manage', 'global'), (req, res) => {
  res.sendFile(buildFullViewPath("admin-dashboard.html"));
});

app.get("/instructor-dashboard", ...protect('course.manage', 'course'), (req, res) => {
  res.sendFile(buildFullViewPath("instructor-dashboard.html"));
});

app.get("/meeting-attendance", ensureAuthenticated, (req, res) => {
  res.sendFile(buildFullViewPath("meeting-attendance.html"));
});

app.get("/meeting-attendance-team-lead", ensureAuthenticated, (req, res) => {
  res.sendFile(buildFullViewPath("meeting-attendance-team-lead.html"));
});

app.get("/instructor-meetings", ensureAuthenticated, (req, res) => {
  // Only allow instructors to access this route
  const email = req.user?.emails?.[0]?.value;
  if (!email) {
    return res.redirect("/login");
  }
  findUserByEmail(email).then(user => {
    if (!user) {
      return res.redirect("/login");
    }
    if (user.primary_role === 'instructor' || user.primary_role === 'admin') {
      return res.sendFile(buildFullViewPath("instructor-meetings.html"));
    }
    return res.status(403).send("Forbidden: Only instructors can access this page");
  }).catch(error => {
    console.error("Error checking instructor role:", error);
    return res.status(500).send("Internal server error");
  });
});


app.get("/ta-dashboard", ensureAuthenticated, async (req, res) => {
  try {
    const email = req.user?.emails?.[0]?.value;
    if (!email) {
      return res.redirect("/login");
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.redirect("/login");
    }

    // Admin and instructor can access TA dashboard (for viewing)
    if (user.primary_role === 'admin' || user.primary_role === 'instructor') {
      return res.sendFile(buildFullViewPath("ta-dashboard.html"));
    }

    // Check if user is enrolled as TA or tutor
    const enrollmentRole = await getUserEnrollmentRole(user.id);
    if (enrollmentRole === 'ta' || enrollmentRole === 'tutor') {
      return res.sendFile(buildFullViewPath("ta-dashboard.html"));
    }

    // Not authorized
    return res.status(403).send("Forbidden: You must be enrolled as a TA or tutor to access this dashboard");
  } catch (error) {
    console.error("Error accessing TA dashboard:", error);
    return res.status(500).send("Internal server error");
  }
});

app.get("/student-dashboard", ensureAuthenticated, async (req, res) => {
  try {
    const email = req.user?.emails?.[0]?.value;
    if (!email) {
      return res.redirect("/login");
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.redirect("/login");
    }

    // Admin and instructor can access student dashboard (for viewing)
    if (user.primary_role === 'admin' || user.primary_role === 'instructor') {
      return res.sendFile(buildFullViewPath("student-dashboard.html"));
    }

    // Check if user is a team lead - redirect to team lead dashboard
    const isTeamLead = await isUserTeamLead(user.id);
    if (isTeamLead) {
      return res.redirect("/team-lead-dashboard");
    }

    // Check if user is enrolled as student or has student primary_role
    const enrollmentRole = await getUserEnrollmentRole(user.id);
    if (enrollmentRole === 'student' || user.primary_role === 'student') {
      return res.sendFile(buildFullViewPath("student-dashboard.html"));
    }

    // Not authorized
    return res.status(403).send("Forbidden: You must be enrolled as a student to access this dashboard");
  } catch (error) {
    console.error("Error accessing student dashboard:", error);
    return res.status(500).send("Internal server error");
  }
});

// Team Lead Dashboard - accessible only to team leads
app.get("/team-lead-dashboard", ensureAuthenticated, async (req, res) => {
  try {
    const email = req.user?.emails?.[0]?.value;
    if (!email) {
      return res.redirect("/login");
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.redirect("/login");
    }

    // Admin and instructor can access team lead dashboard (for viewing)
    if (user.primary_role === 'admin' || user.primary_role === 'instructor') {
      return res.sendFile(buildFullViewPath("student-leader-dashboard.html"));
    }

    // Check if user is a team lead
    const isTeamLead = await isUserTeamLead(user.id);
    if (!isTeamLead) {
      // If not a team lead, redirect to student dashboard
      return res.redirect("/student-dashboard");
    }

    // Check if user is enrolled as student or team-lead
    const enrollmentRole = await getUserEnrollmentRole(user.id);
    if (enrollmentRole === 'student' || enrollmentRole === 'team-lead' || user.primary_role === 'student') {
      return res.sendFile(buildFullViewPath("student-leader-dashboard.html"));
    }

    // Not authorized
    return res.status(403).send("Forbidden: You must be a team lead to access this dashboard");
  } catch (error) {
    console.error("Error accessing team lead dashboard:", error);
    return res.status(500).send("Internal server error");
  }
});

// -------------------- LECTURE ATTENDANCE ROUTES --------------------

/**
 * Instructor Lectures Overview
 * View all lectures and manage attendance sessions
 * Requires: attendance.view or session.manage permission (course scope) - Instructor/TA
 */
app.get("/instructor-lectures", ...protectAny(['attendance.view', 'session.manage', 'course.manage'], 'course'), (req, res) => {
  res.sendFile(buildFullViewPath("instructor-lectures.html"));
});

/**
 * Lecture Builder
 * Create new lecture attendance sessions with questions
 * Requires: session.create or session.manage permission (course scope) - Instructor
 */
app.get("/lecture-builder", ...protectAny(['session.create', 'session.manage', 'course.manage'], 'course'), (req, res) => {
  res.sendFile(buildFullViewPath("lecture-builder.html"));
});

/**
 * Lecture Responses
 * View student responses for a lecture session
 * Query params: ?sessionId=<uuid> or ?lectureId=<uuid>
 * Requires: attendance.view or session.manage permission (course scope) - Instructor/TA
 */
app.get("/lecture-responses", ...protectAny(['attendance.view', 'session.manage', 'course.manage'], 'course'), (req, res) => {
  res.sendFile(buildFullViewPath("lecture-responses.html"));
});

// Roster page - accessible to all authenticated users (view-only)
// Editing (import/export) is restricted to instructors/admins via frontend and API permissions
app.get("/roster", ensureAuthenticated, (req, res) => {
  res.sendFile(buildFullViewPath("roster.html"));
});

app.get("/courses/:courseId/roster", ensureAuthenticated, (req, res) => {
  res.sendFile(buildFullViewPath("roster.html"));
});

/**
 * Student Lecture Response
 * Students can respond to lecture questions after checking in
 * Query params: ?sessionId=<uuid> or ?lectureId=<uuid>
 * Requires: Authentication - Students
 */
app.get("/student-lecture-response", ensureAuthenticated, async (req, res) => {
  try {
    const email = req.user?.emails?.[0]?.value;
    if (!email) {
      return res.redirect("/login");
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.redirect("/login");
    }

    // Allow students, admins, and instructors (for testing/viewing)
    const enrollmentRole = await getUserEnrollmentRole(user.id);
    if (enrollmentRole === 'student' || user.primary_role === 'student' || 
        user.primary_role === 'admin' || user.primary_role === 'instructor') {
      return res.sendFile(buildFullViewPath("student-lecture-response.html"));
    }

    // Not authorized
    return res.status(403).send("Forbidden: You must be enrolled as a student to access this page");
  } catch (error) {
    console.error("Error accessing student lecture response page:", error);
    return res.status(500).send("Internal server error");
  }
});

/**
 * Student Lecture Attendance
 * Students can check in to lectures using access codes
 * Requires: Authentication - Students
 */
app.get("/lecture-attendance-student", ensureAuthenticated, async (req, res) => {
  try {
    const email = req.user?.emails?.[0]?.value;
    if (!email) {
      return res.redirect("/login");
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.redirect("/login");
    }

    // Allow students, admins, and instructors (for testing/viewing)
    const enrollmentRole = await getUserEnrollmentRole(user.id);
    if (enrollmentRole === 'student' || user.primary_role === 'student' || 
        user.primary_role === 'admin' || user.primary_role === 'instructor') {
      return res.sendFile(buildFullViewPath("lecture-attendance-student.html"));
    }

    // Not authorized
    return res.status(403).send("Forbidden: You must be enrolled as a student to access this page");
  } catch (error) {
    console.error("Error accessing lecture attendance page:", error);
    return res.status(500).send("Internal server error");
  }
});

/**
 * Meeting Attendance - Student View
 * Students (including team leads) can check in to team meetings
 * Team leads will be automatically routed to team lead view
 * Requires: Authentication - Students
 */
app.get("/meetings", ensureAuthenticated, async (req, res) => {
  try {
    const email = req.user?.emails?.[0]?.value;
    if (!email) {
      return res.redirect("/login");
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.redirect("/login");
    }

    // Check if user is a team lead
    const offering = await getActiveCourseOffering();
    if (!offering) {
      return res.status(404).send("No active course offering found");
    }

    // Check if user is a team lead - check enrollment role first, then team leadership
    const enrollmentRole = await getUserEnrollmentRole(user.id);
    const isTeamLeadByEnrollment = enrollmentRole === 'team-lead';
    
    // Also check if user is a team leader
    const teamLeadCheck = await pool.query(
      `SELECT t.id, t.leader_id, tm.role, t.team_number, t.name as team_name,
              CASE WHEN t.leader_id = $1 THEN 1 ELSE 2 END as priority
       FROM team t
       LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $1 AND tm.left_at IS NULL
       WHERE t.offering_id = $2 AND (t.leader_id = $1 OR tm.user_id = $1)
       ORDER BY priority, t.team_number
       LIMIT 1`,
      [user.id, offering.id]
    );

    const isTeamLeadByTeam = teamLeadCheck.rows.length > 0 && 
      (teamLeadCheck.rows[0].leader_id === user.id || teamLeadCheck.rows[0].role === 'leader');

    const isTeamLead = isTeamLeadByEnrollment || isTeamLeadByTeam;

    // Allow students, team-leads, admins, and instructors (for testing/viewing)
    const enrollmentRoleForAccess = await getUserEnrollmentRole(user.id);
    if (enrollmentRoleForAccess === 'student' || enrollmentRoleForAccess === 'team-lead' || 
        user.primary_role === 'student' || user.primary_role === 'admin' || 
        user.primary_role === 'instructor') {
      // Serve team lead view if user is a team lead, otherwise student view
      if (isTeamLead) {
        // Team leads get the enhanced team lead dashboard
        return res.sendFile(buildFullViewPath("meeting-attendance-team-lead.html"));
      } else {
        // Regular students get the student view
        return res.sendFile(buildFullViewPath("meeting-attendance-student.html"));
      }
    }

    // Not authorized
    return res.status(403).send("Forbidden: You must be enrolled as a student to access this page");
  } catch (error) {
    console.error("Error accessing meeting attendance page:", error);
    return res.status(500).send("Internal server error");
  }
});

/**
 * Team Lead Meetings - Dedicated route for team leads
 * Team leads can create and manage team meetings
 * Requires: Authentication - Team Leads (who are also students)
 */
app.get("/meetings/team-lead", ensureAuthenticated, async (req, res) => {
  try {
    const email = req.user?.emails?.[0]?.value;
    if (!email) {
      return res.redirect("/login");
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.redirect("/login");
    }

    const offering = await getActiveCourseOffering();
    if (!offering) {
      return res.status(404).send("No active course offering found");
    }

    // Check if user is a team lead
    const isTeamLead = await isUserTeamLead(user.id);
    
    // Allow admins and instructors to view (for testing)
    if (!isTeamLead && user.primary_role !== 'admin' && user.primary_role !== 'instructor') {
      // Redirect non-team-leads to regular meetings page
      return res.redirect("/meetings");
    }

    return res.sendFile(buildFullViewPath("meeting-attendance-team-lead.html"));
  } catch (error) {
    console.error("Error accessing team lead meetings page:", error);
    return res.status(500).send("Internal server error");
  }
});

// serve all your static files (HTML, CSS, JS, etc.) - serve project root for any other static files
app.use(express.static(path.join(__dirname, "..")));

// Serve blocked page with injected email (before static middleware)
app.get("/blocked.html", (req, res) => {
  const email = req.session.blockedEmail || "";
  delete req.session.blockedEmail; // Clear after use

  const filePath = path.join(__dirname, "views", "blocked.html");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error loading page");
    const modified = data.replace(
      "</body>",
      `<script>window.prefilledEmail=${JSON.stringify(email)};</script></body>`
    );
    res.send(modified);
  });
});

// Serve not-in-roster page with injected email
app.get("/not-in-roster.html", (req, res) => {
  const email = req.session.notInRosterEmail || req.user?.emails?.[0]?.value || "";
  delete req.session.notInRosterEmail; // Clear after use

  const filePath = path.join(__dirname, "views", "not-in-roster.html");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error loading page");
    const modified = data.replace(
      "</body>",
      `<script>window.prefilledEmail=${JSON.stringify(email)};</script></body>`
    );
    res.send(modified);
  });
});

// Serve /blocked for legacy routes
app.get("/blocked", (req, res) => {
  res.sendFile(buildFullViewPath("blocked.html"));
});



// -------------------- ROUTES --------------------

// Handle Google OAuth errors (e.g., org_internal)
app.get("/auth/error", (req, res) => {
  console.warn("⚠️ OAuth error detected:", req.query);

  const attemptedEmail =
    req.query.email ||
    req.query.login_hint ||
    req.query.user_email ||
    req.session?.userEmail ||
    "unknown";

  console.log(`🔐 Attempted email: ${attemptedEmail}`);
  logAuthEvent("LOGIN_ERROR_REDIRECT", {
    req,
    message: "OAuth error redirect triggered",
    metadata: { query: req.query }
  });

  // Redirect user to blocked page with their email if available
  req.session.blockedEmail = attemptedEmail;
  res.redirect("/blocked.html");
});

// Always force account chooser on each login attempt
app.get("/auth/google", (req, res, next) => {
  safeLogout(req);

  const loginHint = req.query.email || req.query.login_hint || ""; // capture hint if provided

  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    accessType: "offline",
    includeGrantedScopes: true,
    loginHint, // ✅ helps Google return user email on redirect
    failureRedirect: "/auth/error"
  })(req, res, next);
  console.log("🔄 Starting Google OAuth login flow with hint:", loginHint);
});



app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/failure" }),
  async (req, res) => {
    const email = req.user?.emails?.[0]?.value || "unknown";

    try {
      // DEBUG LOGS
      console.log("🔐 New login detected:");
      console.log("   Session ID:", req.sessionID);
      console.log("   Logged-in user:", email);

      // Ensure user exists in DB (UCSD users as 'unregistered', whitelisted extension as 'student')
      const user = await findOrCreateUser(email, {
        name: req.user.displayName,
        google_id: req.user?.id
      });

      // Log successful callback with user role info
      console.log("✅ Login success for:", email);
      console.log(`[DEBUG] User primary_role: ${user.primary_role}, id: ${user.id}`);
      await logAuthEvent("LOGIN_CALLBACK_SUCCESS", {
        req,
        message: "OAuth callback completed successfully",
        userEmail: email,
        userId: req.user?.id,
        metadata: { provider: "google" },
      });

      // Check if user is in roster (has enrollment) - students must be enrolled
      let enrollmentRole = null;
      try {
        enrollmentRole = await getUserEnrollmentRole(user.id);
      } catch (error) {
        console.log(`[DEBUG] Database error getting enrollment role (non-critical): ${error.message}`);
      }
      
      const offering = await getActiveCourseOffering();
      
      // For students: must be enrolled in the active offering
      if (user.primary_role === 'student' || user.primary_role === 'unregistered') {
        if (!enrollmentRole && offering) {
          // User is not in roster - show error page
          console.log(`[DEBUG] User ${email} is not enrolled in roster, showing error`);
          req.session.notInRosterEmail = email;
          return res.redirect("/not-in-roster.html");
        }
        
        // If unregistered but enrolled, update to student
        if (user.primary_role === 'unregistered' && enrollmentRole === 'student') {
          await updateUserRole(email, 'student');
          user.primary_role = 'student';
        }
      }
      
      // Unregistered users not in roster - show error
      if (user.primary_role === 'unregistered') {
        console.log(`[DEBUG] User ${email} is unregistered and not in roster, showing error`);
        req.session.notInRosterEmail = email;
        return res.redirect("/not-in-roster.html");
      }

      // Dashboard routing based on enrollment role (TA comes from enrollments table)
      
      // Check primary_role for admin/instructor, enrollment for TA/student
      if (user.primary_role === 'admin') {
        return res.redirect("/admin-dashboard");
      }
      
      if (user.primary_role === 'instructor') {
        return res.redirect("/instructor-dashboard");
      }
      
      // TA role comes from enrollments.course_role
      if (enrollmentRole === 'ta' || enrollmentRole === 'tutor') {
        return res.redirect("/ta-dashboard");
      }
      
      // Check if user is a team lead - redirect to team lead dashboard
      const isTeamLead = await isUserTeamLead(user.id);
      if (isTeamLead && (enrollmentRole === 'student' || user.primary_role === 'student')) {
        return res.redirect("/team-lead-dashboard");
      }
      
      // Students (only if they have student primary_role, not unregistered)
      if (enrollmentRole === 'student' || user.primary_role === 'student') {
        return res.redirect("/student-dashboard");
      }
      
      // Default fallback - not in roster
      console.log(`[DEBUG] No role match for ${email}, user not in roster`);
      req.session.notInRosterEmail = email;
      return res.redirect("/not-in-roster.html");
    } catch (error) {
      console.error("Error in /auth/google/callback handler:", error);
      await logAuthEvent("LOGIN_CALLBACK_ERROR", {
        req,
        message: "Error handling OAuth callback",
        userEmail: email,
        metadata: { error: error?.message },
      });
      return res.redirect("/auth/failure");
    }
  });

// Failed login route
app.get("/auth/failure", async (req, res) => {
  console.warn("⚠️ Google OAuth failed or unauthorized user.");
  await logAuthEvent("LOGIN_FAILURE", {
    req,
    message: "Google OAuth failed or unauthorized user",
    metadata: { provider: "google" }
  });

  const email =
    req.session?.userEmail ||
    req.user?.emails?.[0]?.value ||
    req.query.email ||
    req.query.login_hint ||
    req.query.user_email ||
    req.query.openid_email ||
    req.query.id_token_hint ||
    req.query.authuser ||
    req.email ||
    "unknown";

  console.log("🚫 Failed login email captured:", email);

  // Clear the session email after reading it
  if (req.session) {
    delete req.session.userEmail;
    req.session.blockedEmail = email;
  }
  
  res.redirect("/blocked.html");
});


function buildFullViewPath(viewFileName){
  return path.join(__dirname, `${VIEW_DIR}/${viewFileName}`)
}

// Reset any leftover session before showing login page
app.get("/login", (req, res) => {
  // Clear Passport user and Redis session if any
  try {
    safeLogout(req);
    safeDestroySession(req);
  } catch (err) {
    console.error("⚠️ Error while resetting session on /login:", err);
  }

  res.sendFile(buildFullViewPath("login.html"));
});

// Health check endpoint (public, no authentication required)
app.get("/health", async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected"
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error.message
    });
  }
});

app.get("/api/user", ensureAuthenticated, (req, res) => {
  const email = req.user?.emails?.[0]?.value;
  const name = req.user?.displayName;
  const picture = req.user?.photos?.[0]?.value || null;
  
  logAuthEvent("PROFILE_ACCESSED", {
    req,
    message: "Retrieved authenticated user info",
    userEmail: email,
    userId: req.user?.id
  });
  res.json({
    name: name,
    email: email,
    picture: picture
  });
});

app.get("/api/users/navigation-context", ensureAuthenticated, async (req, res) => {
  try {
    const email = req.user?.emails?.[0]?.value;
    if (!email) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const enrollmentRole = await getUserEnrollmentRole(user.id);
    const isTeamLead = await isUserTeamLead(user.id);

    res.json({
      primary_role: user.primary_role,
      enrollment_role: enrollmentRole,
      is_team_lead: isTeamLead
    });
  } catch (error) {
    console.error("Failed to fetch navigation context:", error);
    res.status(500).json({ error: "Failed to determine navigation context" });
  }
});

// API routes for user and enrollment management
app.use("/api/users", userRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/offerings", offeringRoutes);
app.use("/api/interactions", interactionRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/journals", journalRoutes);
app.use("/api/class", courseOfferingRoutes);

// Public endpoint to show current login attempt status (by email if authenticated, else by IP) //TO BE CHECKED
app.get('/api/login-attempts', async (req, res) => {
  const email = req.user?.emails?.[0]?.value || null;
  const identifier = getLoginIdentifier(email, req);
  const status = await getLoginAttemptStatus(identifier);
  const threshold = LOGIN_FAILURE_THRESHOLD;
  const windowMinutes = LOGIN_FAILURE_WINDOW_MINUTES;
  const remaining = Math.max(0, threshold - status.attempts);
  res.json({
    identifier: identifier || 'unknown',
    attempts: status.attempts,
    remaining,
    threshold,
    windowMinutes,
    blocked: status.blocked
  });
});

app.get("/logout", ensureAuthenticated, (req, res, next) => {
  const email = req.user?.emails?.[0]?.value || "unknown";
  const userId = req.user?.id || null;

  console.log("🚪 Logging out session:", req.sessionID);

  logAuthEvent("LOGOUT_INITIATED", {
    req,
    message: "User requested logout",
    userEmail: email,
    userId
  });

  safeLogout(req, (error) => {
    if (error) {
      logAuthEvent("LOGOUT_ERROR", {
        req,
        message: "Error encountered during logout",
        userEmail: email,
        userId,
        metadata: { error: error.message }
      });
      return next(error);
    }

    safeDestroySession(req, () => {
      logAuthEvent("LOGOUT_SUCCESS", {
        req,
        message: "User logged out successfully",
        userEmail: email,
        userId
      });

      // ✅ Just go back to login page
      res.redirect("/login");
    });
  });
});

// Route for switching UCSD accounts: logs out the user, destroys session, and redirects to IdP logout.
app.get("/switch-account", (req, res) => {
  safeLogout(req, () => {
    safeDestroySession(req, () => {
      res.redirect("https://idp.ucsd.edu/idp/profile/Logout?return=https://localhost:8443/login");
    });
  });
});



// HTTP --> HTTPS: only enforce when HTTPS is available
app.use((req, res, next) => {
  if (HTTPS_AVAILABLE) {
    if (!req.secure) {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
  }
  next();
});

// Registration removed - users must be added to roster by admin/instructor
// Show error page instead
app.get("/register.html", (req, res) => {
  return res.redirect("/not-in-roster.html");
});

app.post("/register/submit", (req, res) => {
  // Registration disabled - users must be added to roster
  return res.status(403).json({ 
    error: "Registration is disabled. Please contact your instructor or administrator to be added to the course roster." 
  });
});

// --- Access Request Submission ---
app.post("/request-access", async (req, res) => {
  const { email, reason } = req.body;
  if (!email) return res.status(400).send("Missing email");

  // Check if already approved (whitelisted)
  const whitelisted = await findWhitelistEntry(email);
  if (whitelisted) {
    return res.status(200).send(`<h3>✅ ${email} is already approved for access.</h3>`);
  }

  // Check if an access request already exists
  const existingRequest = await findAccessRequest(email);
  if (existingRequest) {
    // ✅ Update the existing entry instead of skipping
    await updateAccessRequest(email, reason);

    await logAuthEvent("ACCESS_REQUEST_UPDATED", {
      req,
      message: `Access request for ${email} was updated.`,
      userEmail: email,
      metadata: { reason }
    });

    return res.status(200).send(`<h3>🔄 Your previous request for ${email} has been updated successfully.</h3>`);
  }

  // ✅ Create a new request if it doesn't exist
  await createAccessRequest(email, reason);
  await logAuthEvent("ACCESS_REQUEST_SUBMITTED", {
    req,
    message: `Access request submitted by ${email}`,
    userEmail: email,
    metadata: { reason }
  });

  res.status(200).send(`<h3>✅ Your access request for ${email} has been submitted.</h3>`);
});

// --- Simple Admin Approval Page and Approve Route ---
app.get("/admin/whitelist", ...protect('user.manage', 'global'), async (req, res) => {
  try {
  const requests = await getAllAccessRequests();
  const whitelist = await getAllWhitelist();
  res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Whitelist Management</title>
        <style>
          body { font-family: sans-serif; padding: 2rem; max-width: 1200px; margin: 0 auto; }
          h2 { color: #333; border-bottom: 2px solid #ddd; padding-bottom: 0.5rem; }
          ul { list-style: none; padding: 0; }
          li { padding: 0.75rem; margin: 0.5rem 0; background: #f5f5f5; border-radius: 4px; }
          a { color: #4285f4; text-decoration: none; margin-left: 1rem; }
          a:hover { text-decoration: underline; }
          .approved { color: #0f9d58; }
        </style>
      </head>
      <body>
        <h1>Admin Whitelist Management</h1>
    <h2>Pending Access Requests</h2>
        ${requests.length > 0 ? `
    <ul>
      ${requests.map(r => `
              <li>${r.email} — ${r.reason || "No reason provided"} 
          <a href="/admin/approve?email=${encodeURIComponent(r.email)}">Approve</a>
        </li>
      `).join("")}
    </ul>
        ` : '<p>No pending requests.</p>'}
        <h2>Approved Users (Whitelist)</h2>
        ${whitelist.length > 0 ? `
    <ul>
            ${whitelist.map(w => `<li class="approved">${w.email} (approved by: ${w.approved_by || 'system'})</li>`).join("")}
    </ul>
        ` : '<p>No approved users yet.</p>'}
        <p><a href="/admin-dashboard">← Back to Admin Dashboard</a></p>
      </body>
      </html>
  `);
  } catch (error) {
    console.error("Error loading whitelist page:", error);
    res.status(500).send("Error loading whitelist page");
  }
});

app.get("/admin/approve", ...protect('user.manage', 'global'), async (req, res) => {
  try {
  const email = req.query.email;
    if (!email) {
      return res.status(400).send("Missing email parameter");
    }

    // Decode the email in case it's URL encoded
    const decodedEmail = decodeURIComponent(email);
    console.log(`[ADMIN] Approving access for: ${decodedEmail}`);

  // Use findOrCreate to avoid duplicate whitelist entries
    const existing = await findWhitelistEntry(decodedEmail);
  if (!existing) {
      await findOrCreateWhitelist(decodedEmail, req.user?.emails?.[0]?.value || "Admin");
      console.log(`✅ Added ${decodedEmail} to whitelist`);
  } else {
      console.log(`ℹ️ ${decodedEmail} already exists in whitelist.`);
  }

  // Ensure matching user exists in users table (as unregistered, will need to register)
    await findOrCreateUser(decodedEmail, {
      name: decodedEmail.split("@")[0],
    primary_role: 'unregistered'
  });
    console.log(`✅ Created/updated user: ${decodedEmail}`);

    await deleteAccessRequest(decodedEmail);
    console.log(`✅ Deleted access request for: ${decodedEmail}`);

  res.redirect("/admin/whitelist");
  } catch (error) {
    console.error("Error approving access:", error);
    res.status(500).send(`Error approving access: ${error.message}`);
  }
});

// Course enrollment invite features
const INVITE_TTL_HOURS = parsePositiveInt(process.env.INVITE_TTL_HOURS, 72);

// Sign invite token (HMAC-based)
const signToken = (payload) => {
  const secret = process.env.INVITE_SECRET || SESSION_SECRET;
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
};

// Verify invite token
const verifyToken = (token) => {
  const secret = process.env.INVITE_SECRET || SESSION_SECRET;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (sig !== expected) return null;
  try { 
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')); 
  } catch { 
    return null; 
  }
};

// Create invite token for course enrollment
// Uses permission middleware: enrollment.manage with course scope
app.post('/api/courses/:courseId/invites', ...protect('enrollment.manage', 'course'), express.json(), async (req, res) => {
  try {
    const offeringId = req.params.courseId || req.body.offeringId;
    const { course_role = 'student', expiresInHours } = req.body;

    // Validate course_role
    const validRoles = ['student', 'ta', 'tutor'];
    if (!validRoles.includes(course_role)) {
      return res.status(400).json({ error: `Invalid course_role. Must be one of: ${validRoles.join(', ')}` });
    }

    // Verify offering exists
    const offeringResult = await pool.query(
      'SELECT id, code, name FROM course_offerings WHERE id = $1::uuid AND is_active = TRUE',
      [offeringId]
    );

    if (offeringResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course offering not found' });
    }

    const offering = offeringResult.rows[0];
    const ttlHours = expiresInHours ? parsePositiveInt(expiresInHours, INVITE_TTL_HOURS) : INVITE_TTL_HOURS;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    // Create token payload
    const payload = {
      offering_id: offeringId,
      course_role,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString()
    };

    const token = signToken(payload);

    res.json({
      token,
      offering: {
        id: offering.id,
        code: offering.code,
        name: offering.name
      },
      course_role,
      expires_at: expiresAt.toISOString(),
      invite_url: `${req.protocol}://${req.get('host')}/enroll/${token}`
    });
  } catch (error) {
    console.error('Error creating invite:', error);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// Enroll using invite token
app.get('/enroll/:token', ensureAuthenticated, async (req, res) => {
  try {
    const token = req.params.token;
    const payload = verifyToken(token);

    if (!payload) {
      return res.status(400).send('<h2>❌ Invalid or expired invite token</h2><p><a href="/login">Go to login</a></p>');
    }

    // Check if token is expired
    const expiresAt = new Date(payload.expires_at);
    if (expiresAt < new Date()) {
      return res.status(400).send('<h2>❌ Invite token has expired</h2><p><a href="/login">Go to login</a></p>');
    }

    const email = req.user?.emails?.[0]?.value;
    if (!email) {
      return res.redirect('/login');
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).send('<h2>❌ User not found</h2>');
    }

    const { offering_id, course_role } = payload;

    // Verify offering exists and is active
    const offeringResult = await pool.query(
      'SELECT id, code, name FROM course_offerings WHERE id = $1::uuid AND is_active = TRUE',
      [offering_id]
    );

    if (offeringResult.rows.length === 0) {
      return res.status(404).send('<h2>❌ Course offering not found or inactive</h2>');
    }

    const offering = offeringResult.rows[0];

    // Check if already enrolled
    const existingEnrollment = await pool.query(
      'SELECT id, course_role, status FROM enrollments WHERE offering_id = $1::uuid AND user_id = $2::uuid',
      [offering_id, user.id]
    );

    if (existingEnrollment.rows.length > 0) {
      const enrollment = existingEnrollment.rows[0];
      if (enrollment.status === 'enrolled') {
        return res.send(`<h2>✅ You are already enrolled in ${offering.name} (${offering.code})</h2><p>Role: ${enrollment.course_role}</p><p><a href="/dashboard">Go to dashboard</a></p>`);
      }
      // If dropped, re-enroll
      await pool.query(
        `UPDATE enrollments 
         SET status = 'enrolled'::enrollment_status_enum, 
             course_role = $1::enrollment_role_enum,
             enrolled_at = CURRENT_DATE,
             dropped_at = NULL
         WHERE id = $2::uuid`,
        [course_role, enrollment.id]
      );
      return res.send(`<h2>✅ Re-enrolled in ${offering.name} (${offering.code})</h2><p>Role: ${course_role}</p><p><a href="/dashboard">Go to dashboard</a></p>`);
    }

    // Create new enrollment
    await enrollUserInCourse(user.id, offering_id, course_role);

    res.send(`<h2>✅ Successfully enrolled in ${offering.name} (${offering.code})</h2><p>Role: ${course_role}</p><p><a href="/dashboard">Go to dashboard</a></p>`);
  } catch (error) {
    console.error('Error enrolling with token:', error);
    res.status(500).send('<h2>❌ Error enrolling in course</h2><p>Please try again later.</p>');
  }
});

// Get user's enrollments (my courses)
app.get('/api/my-courses', ensureAuthenticated, async (req, res) => {
  try {
    const email = req.user?.emails?.[0]?.value;
    if (!email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.json({ courses: [] });
    }

    // Get all enrollments for user with course offering details
    const result = await pool.query(
      `SELECT 
        e.id as enrollment_id,
        e.course_role,
        e.status,
        e.enrolled_at,
        e.dropped_at,
        e.final_grade,
        e.grade_marks,
        co.id as offering_id,
        co.code,
        co.name,
        co.department,
        co.term,
        co.year,
        co.credits,
        co.start_date,
        co.end_date,
        co.status as offering_status,
        co.location,
        co.syllabus_url
      FROM enrollments e
      INNER JOIN course_offerings co ON e.offering_id = co.id
      WHERE e.user_id = $1::uuid
      ORDER BY e.enrolled_at DESC`,
      [user.id]
    );

    const courses = result.rows.map(row => ({
      enrollment_id: row.enrollment_id,
      course_role: row.course_role,
      status: row.status,
      enrolled_at: row.enrolled_at,
      dropped_at: row.dropped_at,
      final_grade: row.final_grade,
      grade_marks: row.grade_marks,
      offering: {
        id: row.offering_id,
        code: row.code,
        name: row.name,
        department: row.department,
        term: row.term,
        year: row.year,
        credits: row.credits,
        start_date: row.start_date,
        end_date: row.end_date,
        status: row.offering_status,
        location: row.location,
        syllabus_url: row.syllabus_url
      }
    }));

    res.json({ courses });
  } catch (error) {
    console.error('Error fetching user courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// -------------------- START SERVER --------------------
// All routes must be defined BEFORE starting the server
const startServer = async () => {
  try {
    // Check if database is empty and initialize with seed data if needed
    const schemaExists = await DatabaseInitializer.verifySchema();
    
    if (!schemaExists) {
      console.log("[database] Database is empty. Initializing with seed data...\n");
      await DatabaseInitializer.initialize({ seed: true, force: false });
      console.log("✅ Database initialized and seeded successfully");
    } else {
      console.log("[database] Database schema already exists. Skipping initialization.\n");
      console.log("✅ Database connection established");
    }
  } catch (error) {
    console.error("Failed to connect to the database", error);
    process.exit(1);
  }

  if (HTTPS_AVAILABLE && sslOptions) {
    https.createServer(sslOptions, app).listen(8443, () => {
      console.log("✅ HTTPS server running at https://localhost:8443");
    });
  } else {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`⚠️ HTTPS not available — running HTTP server at http://localhost:${PORT}`);
    });
  }
};

// Only start server if this file is run directly, not when imported
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
} else if (process.env.VERCEL) {
  // For Vercel, initialize database on cold start
  (async () => {
    try {
      const { DatabaseInitializer } = await import('./database/init.js');
      await DatabaseInitializer.initialize();
      console.log("✅ Database connection established for Vercel");
    } catch (error) {
      console.error("Failed to connect to the database", error);
    }
  })();
} else {
  // Fallback: if the check fails on some systems, start anyway if not in Vercel
  console.log('[server] Starting server (fallback path)');
  startServer();
}

// Export app for Vercel
export default app;
