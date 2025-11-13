import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import path from "path";
import https from "https";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "redis";
import { RedisStore } from "connect-redis";
// import { trackLoginAttempt, isBlocked } from "./js/middleware/loginAttemptTracker.js";
import { createSequelize } from "./src/config/db.js";
import { defineAuthLogModel } from "./src/models/auth-log.js";
import crypto from "crypto";
import { defineCourseModels, initCourseAssociations } from "./src/models/course-models.js";
import bodyParser from "body-parser";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEW_DIR = "src/views"

dotenv.config();

// SSL certificate and key
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, "certs", "server.key")),
  cert: fs.readFileSync(path.join(__dirname, "certs", "server.crt")),
};

const app = express();
// Serve static frontend assets
app.use(express.static(path.join(__dirname, "src/views")));
app.use(express.static(path.join(__dirname, "src/public")));
app.use('/assets', express.static(path.join(__dirname, 'src/assets')));

// -------------------- CONFIG --------------------
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || "https://localhost:8443/auth/google/callback";
const DATABASE_URL = process.env.DATABASE_URL;
const PG_SSL_MODE = process.env.PGSSLMODE;
const ALLOWED_DOMAIN = process.env.ALLOWED_GOOGLE_DOMAIN || "ucsd.edu";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

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

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL. Set DATABASE_URL in your environment for auth logging.");
  process.exit(1);
}

const sequelize = createSequelize({ databaseUrl: DATABASE_URL, sslMode: PG_SSL_MODE });
const AuthLog = defineAuthLogModel(sequelize);
const { Course, CourseUser, Invite } = defineCourseModels(sequelize);

// ---------- Define User Model ----------
import { DataTypes } from "sequelize";

const User = sequelize.define("User", {
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  name: { type: DataTypes.STRING },
  user_type: {
    type: DataTypes.ENUM("Admin", "Professor", "TA", "Student", "Unregistered"),
    defaultValue: "Unregistered"
  },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: "users",
  timestamps: false
});

// Initialize associations using explicit FKs before sync
initCourseAssociations(sequelize, { User, Course, CourseUser, Invite });
// Ensure tables exist on startup
await sequelize.sync({ alter: true });


const redisClient = createClient({ url: REDIS_URL });
redisClient.on("error", (error) => {
  console.error("Redis client error", error);
});
redisClient.connect().catch((error) => {
  console.error("Failed to connect to Redis", error);
});

const extractIpAddress = (req) => {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req?.socket?.remoteAddress || null;
};

const logAuthEvent = async (eventType, { req, message, userEmail, userId, metadata } = {}) => {
  if (!AuthLog) return;

  try {
    await AuthLog.create({
      eventType,
      message: message || null,
      userEmail:
        userEmail
        || req?.user?.emails?.[0]?.value
        || req?.user?.email
        || null,
      ipAddress: req ? extractIpAddress(req) : null,
      userId: userId || req?.user?.id || null,
      path: req?.originalUrl || null,
      metadata: metadata ? { ...metadata } : {}
    });
  } catch (error) {
    console.error("Failed to persist auth log", error);
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
  if (!identifier) {
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
  if (!identifier) return 0;
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
  if (!identifier) return;
  try {
    await redisClient.del(getLoginAttemptKey(identifier));
  } catch (error) {
    console.error("Unable to clear login attempts", error);
  }
};

const ensureAuthenticated = async (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  const pathMeta = req.originalUrl || req.url;
  const eventType = pathMeta && pathMeta.startsWith("/api/user")
    ? "PROFILE_UNAUTHORIZED"
    : "ROUTE_UNAUTHORIZED_ACCESS";

  await logAuthEvent(eventType, {
    req,
    message: "Request blocked by ensureAuthenticated middleware",
    metadata: { path: pathMeta }
  });

  const prefersJson = req.xhr
    || req.get("x-requested-with") === "XMLHttpRequest"
    || req.accepts(["json", "html"]) === "json";

  if (prefersJson) {
    return res.status(401).json({ error: "unauthorized" });
  }

  return res.redirect("/login");
};

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
  const { blocked, attempts: recentAttempts } = await getLoginAttemptStatus(identifier);

  if (blocked) {
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
    if (domain !== ALLOWED_DOMAIN) {
      const attempts = await recordFailedLoginAttempt(identifier);
      await logAuthEvent("LOGIN_REJECTED_DOMAIN", {
        req,
        message: `Attempted login from disallowed domain ${domain || "unknown"}`,
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
      return done(null, false, { message: "Non-UCSD account" });
    }

    // UCSD domain: upsert user, attach role
    const [userRecord] = await User.findOrCreate({
      where: { email },
      defaults: { name: profile.displayName || null, user_type: "Unregistered" }
    });

    // Clear attempts on success
    await clearLoginAttempts(identifier);

    // Attach role to profile for session persistence
    const userWithRole = { ...profile, role: userRecord.user_type, email };

    await logAuthEvent("LOGIN_SUCCESS", {
      req,
      message: "Google OAuth login succeeded",
      userEmail: email,
      userId,
      metadata: { provider: "google", role: userRecord.user_type }
    });

    return done(null, userWithRole);
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
    return done(error);
  }
}));

console.log("✅ OAuth callback configured for:", CALLBACK_URL);


passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 60 * 1000, // Cookie Time
    },
  })
);



// -------------------- MIDDLEWARE --------------------
app.use(passport.initialize());
app.use(passport.session());

app.get("/dashboard", ensureAuthenticated, (req, res) => {
  // Fallback dashboard if role-based route not used
  res.sendFile(buildFullViewPath("dashboard.html"));
});

// Role-based dashboards
app.get("/student-dashboard", ensureAuthenticated, (req, res) => res.sendFile(buildFullViewPath("student-dashboard.html")));
app.get("/ta-dashboard", ensureAuthenticated, (req, res) => res.sendFile(buildFullViewPath("ta-dashboard.html")));
app.get("/faculty-dashboard", ensureAuthenticated, (req, res) => res.sendFile(buildFullViewPath("professor-dashboard.html")));
app.get("/admin-dashboard", ensureAuthenticated, (req, res) => res.sendFile(buildFullViewPath("admin-dashboard.html")));

// serve all your static files (HTML, CSS, JS, etc.)
app.use(express.static(__dirname));
// Serve blocked page
app.get("/blocked", (req, res) => {
  res.sendFile(buildFullViewPath("blocked.html"));

});

// Root route serves landing page
app.get('/', (_req, res) => {
  res.sendFile(buildFullViewPath('index.html'));
});

// -------------------- ROUTES --------------------
app.get("/auth/google", (req, res, next) => {
  console.log("🔄 /auth/google hit. Redirecting to Google with callback:", CALLBACK_URL);
  // If user was trying to enroll via token, preserve target for after login
  const pending = req.query.next || req.session.nextAfterLogin;
  if (pending) req.session.nextAfterLogin = pending;
  logAuthEvent("LOGIN_REDIRECT", {
    req,
    message: "Redirecting user to Google OAuth",
    metadata: { provider: "google", callbackURL: CALLBACK_URL }
  });
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

// OAuth callback to issue role-based redirect
app.get("/auth/google/callback", (req, res, next) => {
  passport.authenticate("google", { failureRedirect: "/auth/failure" }, async (err, user) => {
    if (err) return next(err);
    if (!user) return res.redirect("/auth/failure");

    req.logIn(user, async (loginErr) => {
      if (loginErr) return next(loginErr);

      // After login, if we have a pending next, use it
      const nextAfterLogin = req.session.nextAfterLogin;
      if (nextAfterLogin) {
        delete req.session.nextAfterLogin;
        return res.redirect(nextAfterLogin);
      }

      const role = req.user?.role || "Student";
      switch (role) {
        case "Professor":
          return res.redirect("/professor-dashboard");
        case "TA":
        case "Tutor":
          return res.redirect("/ta-dashboard");
        case "Admin":
          return res.redirect("/admin-dashboard");
        case "Student":
        default:
          return res.redirect("/student-dashboard");
      }
    });
  })(req, res, next);
});


// Failed login route
app.get("/auth/failure", async (req, res) => {
  console.warn("⚠️ Google OAuth failed or unauthorized user.");
  await logAuthEvent("LOGIN_FAILURE", {
    req,
    message: "Google OAuth failed or unauthorized user",
    metadata: { provider: "google" }
  });
  res.redirect("/blocked");
});


function buildFullViewPath(viewFileName){
  return path.join(__dirname, `${VIEW_DIR}/${viewFileName}`)
}

app.get("/login", (req, res) =>{
  res.sendFile(buildFullViewPath("login.html"))
});




app.get("/api/user", ensureAuthenticated, (req, res) => {
  logAuthEvent("PROFILE_ACCESSED", {
    req,
    message: "Retrieved authenticated user info",
    userEmail: req.user?.emails?.[0]?.value,
    userId: req.user?.id
  });
  res.json({
    name: req.user.displayName,
    email: req.user.emails[0].value,
    picture: req.user.photos[0].value
  });
});

// Public endpoint to show current login attempt status (by email if authenticated, else by IP)
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
  logAuthEvent("LOGOUT_INITIATED", {
    req,
    message: "User requested logout",
    userEmail: email,
    userId
  });
  req.logout((error) => {
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

    logAuthEvent("LOGOUT_SUCCESS", {
      req,
      message: "User logged out successfully",
      userEmail: email,
      userId
    });
    res.redirect("/login");
  });
});

// HTTP --> HTTPS
app.use((req, res, next) => {
  if (!req.secure) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// ADD A Simple POST to register login
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/register/submit", ensureAuthenticated, async (req, res) => {
  const email = req.user?.emails?.[0]?.value;
  const newRole = req.body.role;
  if (!email || !newRole) return res.status(400).send("Invalid request");

  await User.update({ user_type: newRole }, { where: { email } });
  res.send(`<h2>✅ Role updated to ${newRole}. Please <a href="/auth/google">relogin</a>.</h2>`);
});

// --- START HTTPS SERVER ---
const startServer = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true }); // create users table if missing
    console.log("✅ Database connection established");
  } catch (error) {
    console.error("Failed to connect to the database", error);
    process.exit(1);
  }

  https.createServer(sslOptions, app).listen(8443, () => {
    console.log("✅ HTTPS server running at https://localhost:8443");
  });
};

// -------------------- INVITE & ENROLLMENT --------------------
const INVITE_TTL_HOURS = parsePositiveInt(process.env.INVITE_TTL_HOURS, 72);
const signToken = (payload) => {
  const secret = process.env.INVITE_SECRET || SESSION_SECRET;
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
};
const verifyToken = (token) => {
  const secret = process.env.INVITE_SECRET || SESSION_SECRET;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (sig !== expected) return null;
  try { return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')); } catch { return null; }
};

const requireInstructorOfCourse = async (req, res, next) => {
  const email = req.user?.emails?.[0]?.value;
  const courseId = Number.parseInt(req.params.courseId, 10);
  const cu = await CourseUser.findOne({ where: { course_id: courseId }, include: [{ model: User, where: { email } }, { model: Course }] });
  if (!cu || (cu.role !== 'Professor' && cu.role !== 'TA' && cu.role !== 'Tutor')) {
    await logAuthEvent('COURSE_FORBIDDEN', { req, message: 'Not course staff', metadata: { courseId } });
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
};

// Create invites
app.post('/api/courses/:courseId/invites', ensureAuthenticated, requireInstructorOfCourse, express.json(), async (req, res) => {
  const { type, emails = [], role = 'Student' } = req.body; // type: 'ucsd'|'extension'|'staff'
  const courseId = Number.parseInt(req.params.courseId, 10);
  const creator = req.user?.emails?.[0]?.value;
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000);

  if (type === 'ucsd') {
    // Open UCSD link, not bound to email
    const payload = { courseId, kind: 'ucsd', role: 'Student', exp: expiresAt.getTime() };
    const token = signToken(payload);
    const invite = await Invite.create({ course_id: courseId, email: null, role: 'Student', token, expires_at: expiresAt, created_by: creator, kind: 'ucsd', verified: true });
    return res.json({ link: `/enroll/${invite.token}` });
  }

  // Email-bound invites (extension or staff)
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'emails required' });
  }

  const results = [];
  for (const email of emails) {
    const payload = { courseId, kind: type === 'staff' ? 'staff' : 'extension', email, role: type === 'staff' ? role : 'Student', exp: expiresAt.getTime() };
    const token = signToken(payload);
    const invite = await Invite.create({ course_id: courseId, email, role: payload.role, token, expires_at: expiresAt, created_by: creator, kind: payload.kind });
    // TODO: send email with `${BASE_URL}/enroll/${token}`
    results.push({ email, link: `/enroll/${invite.token}` });
  }
  res.json({ invites: results });
});

// Enroll via token
app.get('/enroll/:token', async (req, res) => {
  const { token } = req.params;
  const decoded = verifyToken(token);
  if (!decoded || !decoded.exp || decoded.exp < Date.now()) {
    await logAuthEvent('INVITE_INVALID', { req, message: 'Invalid or expired token' });
    return res.status(400).send('Invalid invite');
  }

  const invite = await Invite.findOne({ where: { token } });
  if (!invite) return res.status(400).send('Invalid invite');

  // Require auth; if not logged in, bounce to google with return
  if (!(req.isAuthenticated && req.isAuthenticated())) {
    req.session.nextAfterLogin = `/enroll/${token}`;
    return res.redirect(`/auth/google?next=${encodeURIComponent(`/enroll/${token}`)}`);
  }

  const email = req.user?.emails?.[0]?.value;

  if (decoded.kind === 'ucsd') {
    if (!email?.endsWith('@ucsd.edu')) {
      await logAuthEvent('ENROLL_REJECTED_DOMAIN', { req, message: 'Non-UCSD attempted UCSD link' });
      return res.status(403).send('UCSD account required');
    }
  } else {
    // extension/staff invites must match email
    if (decoded.email?.toLowerCase() !== email?.toLowerCase()) {
      await logAuthEvent('INVITE_EMAIL_MISMATCH', { req, message: 'Invite email mismatch', userEmail: email });
      return res.status(403).send('Invite not issued to this email');
    }
  }

  // Enroll
  const { courseId } = decoded;
  const [userRecord] = await User.findOrCreate({ where: { email }, defaults: { name: req.user.displayName || null, user_type: 'Student' } });
  await CourseUser.findOrCreate({ where: { course_id: courseId, user_id: userRecord.id }, defaults: { course_id: courseId, user_id: userRecord.id, role: decoded.role || 'Student' } });
  await Invite.update({ verified: true, accepted_at: new Date() }, { where: { id: invite.id } });
  await logAuthEvent('ENROLL_SUCCESS', { req, message: 'Enrollment success', userEmail: email, metadata: { courseId, kind: decoded.kind } });

  // Redirect by role to dashboard
  const role = decoded.role || 'Student';
  if (role === 'TA' || role === 'Tutor') return res.redirect('/ta-dashboard');
  if (role === 'Professor') return res.redirect('/professor-dashboard');
  return res.redirect('/student-dashboard');
});

// My courses endpoint
app.get('/api/my-courses', ensureAuthenticated, async (req, res) => {
  const email = req.user?.emails?.[0]?.value;
  const userRecord = await User.findOne({ where: { email } });
  if (!userRecord) return res.json({ courses: [] });
  const memberships = await CourseUser.findAll({ where: { user_id: userRecord.id }, include: [Course] });
  const courses = memberships.map(m => ({ id: m.Course.id, code: m.Course.code, title: m.Course.title, role: m.role }));
  res.json({ courses });
});

startServer();