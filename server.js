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
app.use(express.static(path.join(__dirname, "src/views")));

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

const LOGIN_FAILURE_THRESHOLD = parsePositiveInt(process.env.LOGIN_FAILURE_THRESHOLD, 5);
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

// ---- Whitelist and AccessRequest Models ----
import { defineWhitelistModel } from "./src/models/whitelist.js";
import { defineAccessRequestModel } from "./src/models/access-request.js";
const Whitelist = defineWhitelistModel(sequelize);
const AccessRequest = defineAccessRequestModel(sequelize);

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


  // --- Whitelist bypass for rate limits ---
  if (email) {
    const whitelistEntry = await Whitelist.findOne({ where: { email } });
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

  console.log(`🔐 Login attempt for email: ${email}. Blocked: ${blocked}. Recent attempts: ${recentAttempts}`);
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
    // --- Step 1: UCSD domain always allowed ---
    if (domain === ALLOWED_DOMAIN) {
      console.log(`🔐 UCSD domain login successful email: ${email}`);
      await clearLoginAttempts(identifier);
      await logAuthEvent("LOGIN_SUCCESS", {
        req,
        message: "Google OAuth login succeeded (UCSD domain)",
        userEmail: email,
        userId,
        metadata: { provider: "google" }
      });
      return done(null, profile);
    }

    // --- Step 2: Non-UCSD (gmail etc.) → check whitelist ---
    console.log(`🔐 Non-UCSD domain login successful email: ${email}`);
    if (email) {
      console.log(`[TRACE] Checking whitelist for email: ${email}`);
      const whitelistEntry = await Whitelist.findOne({ where: { email } });
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

        // ✅ Treat whitelisted users as 'Unregistered'
        console.log(`[TRACE] Creating or finding 'Unregistered' user for email: ${email}`);
        await User.findOrCreate({
          where: { email },
          defaults: {
            name: profile.displayName,
            user_type: "Unregistered"
          }
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

app.get("/dashboard", ensureAuthenticated, (_req, res) => {
  res.sendFile(buildFullViewPath("dashboard.html"));
});

// serve all your static files (HTML, CSS, JS, etc.)
app.use(express.static(__dirname));

// Serve blocked page with injected email (before static middleware)
app.get("/blocked.html", (req, res) => {
  const email = req.session.blockedEmail || "";
  delete req.session.blockedEmail; // Clear after use

  const filePath = path.join(__dirname, "src/views/blocked.html");
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
  req.logout(() => {});       // clear any cached user
  req.session?.destroy(() => {});  // destroy session

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



app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/failure" }),
  async (req, res) => {
    const email = req.user?.emails?.[0]?.value || "unknown";

     // ✅ DEBUG LOGS
    console.log("🔐 New login detected:");
    console.log("   Session ID:", req.sessionID);
    console.log("   Logged-in user:", email);

    // Adding Middleware for USER redirection

    // Check if user exists in DB
  const [user, created] = await User.findOrCreate({
    where: { email },
    defaults: {
      name: req.user.displayName,
      user_type: "Unregistered"
    }
  });


  // Redirect based on user type
  switch (user.user_type) {
    case "Admin":
      return res.redirect("/admin-dashboard.html");
    case "Professor":
      return res.redirect("/faculty-dashboard.html");
    case "TA":
      return res.redirect("/ta-dashboard.html");
    case "Student":
      return res.redirect("/student-dashboard.html");
    default:
      return res.redirect("/register.html");
  }


    console.log("✅ Login success for:", email);
    await logAuthEvent("LOGIN_CALLBACK_SUCCESS", {
      req,
      message: "OAuth callback completed successfully",
      userEmail: email,
      userId: req.user?.id,
      metadata: { provider: "google" }
    });
    res.redirect("/dashboard");
  }
);

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
  }

  req.session.blockedEmail = email;
  res.redirect("/blocked.html");
});


function buildFullViewPath(viewFileName){
  return path.join(__dirname, `${VIEW_DIR}/${viewFileName}`)
}

// Reset any leftover session before showing login page
app.get("/login", (req, res) => {
  // Clear Passport user and Redis session if any
  try {
    if (req.logout) req.logout(() => {});
    if (req.session) req.session.destroy(() => {});
  } catch (err) {
    console.error("⚠️ Error while resetting session on /login:", err);
  }

  res.sendFile(buildFullViewPath("login.html"));
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

    req.session.destroy(() => {
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
  req.logout(() => {});
  if (req.session) {
    req.session.destroy(() => {
      res.redirect("https://idp.ucsd.edu/idp/profile/Logout?return=https://localhost:8443/login");
    });
  } else {
    res.redirect("https://idp.ucsd.edu/idp/profile/Logout?return=https://localhost:8443/login");
  }
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
app.use(bodyParser.json());

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

startServer();


// --- Access Request Submission ---
app.post("/request-access", async (req, res) => {
  const { email, reason } = req.body;
  if (!email) return res.status(400).send("Missing email");

  // Check if already approved (whitelisted)
  const whitelisted = await Whitelist.findOne({ where: { email } });
  if (whitelisted) {
    return res.status(200).send(`<h3>✅ ${email} is already approved for access.</h3>`);
  }

  // Check if an access request already exists
  const existingRequest = await AccessRequest.findOne({ where: { email } });
  if (existingRequest) {
    // ✅ Update the existing entry instead of skipping
    await existingRequest.update({ reason, requested_at: new Date() });

    await logAuthEvent("ACCESS_REQUEST_UPDATED", {
      req,
      message: `Access request for ${email} was updated.`,
      userEmail: email,
      metadata: { reason }
    });

    return res.status(200).send(`<h3>🔄 Your previous request for ${email} has been updated successfully.</h3>`);
  }

  // ✅ Create a new request if it doesn’t exist
  await AccessRequest.create({ email, reason });
  await logAuthEvent("ACCESS_REQUEST_SUBMITTED", {
    req,
    message: `Access request submitted by ${email}`,
    userEmail: email,
    metadata: { reason }
  });

  res.status(200).send(`<h3>✅ Your access request for ${email} has been submitted.</h3>`);
});

// --- Simple Admin Approval Page and Approve Route ---
app.get("/admin/whitelist", async (req, res) => {
  const requests = await AccessRequest.findAll();
  const whitelist = await Whitelist.findAll();
  res.send(`
    <h2>Pending Access Requests</h2>
    <ul>
      ${requests.map(r => `
        <li>${r.email} — ${r.reason || ""} 
          <a href="/admin/approve?email=${encodeURIComponent(r.email)}">Approve</a>
        </li>
      `).join("")}
    </ul>
    <h2>Approved Users</h2>
    <ul>
      ${whitelist.map(w => `<li>${w.email}</li>`).join("")}
    </ul>
  `);
});

app.get("/admin/approve", async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).send("Missing email");

  // Use findOrCreate to avoid duplicate whitelist entries
  const [entry, created] = await Whitelist.findOrCreate({
    where: { email },
    defaults: { approved_by: "Admin" }
  });
  if (!created) {
    console.log(`ℹ️ ${email} already exists in whitelist.`);
  }

  // Ensure matching user exists in users table
  await User.findOrCreate({
    where: { email },
    defaults: {
      name: email.split("@")[0],
      user_type: "Unregistered"
    }
  });

  await AccessRequest.destroy({ where: { email } });
  res.redirect("/admin/whitelist");
});