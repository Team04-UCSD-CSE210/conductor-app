import express from "express";
import session from "express-session";
import passport from "passport";
import {Strategy as GoogleStrategy} from "passport-google-oauth20";
import path from "path";
import https from "https";
import fs from "fs";
import {fileURLToPath} from "url";
import dotenv from "dotenv";
import {createClient} from "redis";
import {RedisStore} from "connect-redis";
// import { trackLoginAttempt, isBlocked } from "./js/middleware/loginAttemptTracker.js";
import {createSequelize} from "./src/config/db.js";
import {defineAuthLogModel} from "./src/models/auth-log.js";
import crypto from "crypto";
import {defineCourseModels, initCourseAssociations} from "./src/models/course-models.js";
import bodyParser from "body-parser";
import {registerGroupApis} from "./src/middleware/class-dirs/group-api.js";
import {registerClassApis} from "./src/middleware/class-dirs/class-api.js";
// Add imports for new Sequelize models
import {defineCourseOfferingModel} from "./src/models/course-offerings.js";
import {defineTeamModel} from "./src/models/team.js";
import {defineTeamMembersModel} from "./src/models/team-members.js";
import {defineUserModel} from "./src/models/users.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEW_DIR = "src/views"

dotenv.config();

// SSL certificate and key (optional for local dev)
let sslOptions = null;
let HTTPS_AVAILABLE = false;
try {
    const keyPath = path.join(__dirname, "certs", "server.key");
    const certPath = path.join(__dirname, "certs", "server.crt");
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

const sequelize = createSequelize({databaseUrl: DATABASE_URL, sslMode: PG_SSL_MODE});
const AuthLog = defineAuthLogModel(sequelize);
const {Course, CourseUser, Invite} = defineCourseModels(sequelize);

// Initialize new models based on schema.sql
const CourseOffering = defineCourseOfferingModel(sequelize);
const Team = defineTeamModel(sequelize);
const TeamMember = defineTeamMembersModel(sequelize);
const User = defineUserModel(sequelize);

// ---------- Define User Model ----------
// import { DataTypes } from "sequelize";

// const User = sequelize.define("User", {
//   email: { type: DataTypes.STRING, unique: true, allowNull: false },
//   name: { type: DataTypes.STRING },
//   user_type: {
//     type: DataTypes.ENUM("Admin", "Professor", "TA", "Student", "Unregistered"),
//     defaultValue: "Unregistered"
//   },
//   created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
// }, {
//   tableName: "users",
//   timestamps: false
// });

// ---- Whitelist and AccessRequest Models ----
import {defineWhitelistModel} from "./src/models/whitelist.js";
import {defineAccessRequestModel} from "./src/models/access-request.js";

const Whitelist = defineWhitelistModel(sequelize);
const AccessRequest = defineAccessRequestModel(sequelize);

// Initialize associations using explicit FKs before sync
initCourseAssociations(sequelize, {User, Course, CourseUser, Invite});
// Ensure tables exist on startup
// await sequelize.sync({ alter: true });


// const redisClient = createClient({ url: REDIS_URL });
// redisClient.on("error", (error) => {
//   console.error("Redis client error", error);
// });
// redisClient.connect().catch((error) => {
//   console.error("Failed to connect to Redis", error);
// });

// const extractIpAddress = (req) => {
//   const forwarded = req?.headers?.["x-forwarded-for"];
//   if (forwarded) {
//     return forwarded.split(",")[0].trim();
//   }
//   return req?.socket?.remoteAddress || null;
// };
// local dev

// --- Redis client (switched off in local dev) ---
let redisClient;

if (!REDIS_URL || process.env.NODE_ENV === "development") {
    // In local development, or when REDIS_URL is not set,
    // we disable real Redis and use a simple in-memory fallback.
    console.warn(
        "⚠️ DEV MODE: Redis is disabled (no REDIS_URL or NODE_ENV=development). " +
        "Using in-memory store for rate limiting."
    );

    const memoryStore = new Map();

    // Minimal async API to mimic the Redis methods used in the codebase.
    redisClient = {
        async incr(key) {
            const current = Number(memoryStore.get(key) || 0) + 1;
            memoryStore.set(key, current);
            return current;
        },
        async expire(key, seconds) {
            // Simple TTL implementation for dev: schedule a delete.
            setTimeout(() => {
                memoryStore.delete(key);
            }, seconds * 1000);
            return true;
        },
        async get(key) {
            const value = memoryStore.get(key);
            return value !== undefined ? String(value) : null;
        },
    };
} else {
    // Production / real environment: connect to actual Redis instance.
    redisClient = createClient({url: REDIS_URL});

    redisClient.on("error", (error) => {
        console.error("Redis client error", error);
    });

    redisClient.connect().catch((error) => {
        console.error("Failed to connect to Redis", error);
    });
}

// Helper to extract client IP address for rate limiting.
const extractIpAddress = (req) => {
    const forwarded = req?.headers?.["x-forwarded-for"];
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    return req?.socket?.remoteAddress || null;
};


const logAuthEvent = async (eventType, {req, message, userEmail, userId, metadata} = {}) => {
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
            metadata: metadata ? {...metadata} : {}
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
        return {attempts: 0, blocked: false};
    }
    try {
        const rawAttempts = await redisClient.get(getLoginAttemptKey(identifier));
        const attempts = rawAttempts ? Number.parseInt(rawAttempts, 10) : 0;
        if (Number.isNaN(attempts)) {
            return {attempts: 0, blocked: false};
        }
        return {
            attempts,
            blocked: attempts >= LOGIN_FAILURE_THRESHOLD
        };
    } catch (error) {
        console.error("Unable to read login attempt count", error);
        return {attempts: 0, blocked: false};
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
        metadata: {path: pathMeta}
    });

    const prefersJson = req.xhr
        || req.get("x-requested-with") === "XMLHttpRequest"
        || req.accepts(["json", "html"]) === "json";

    if (prefersJson) {
        return res.status(401).json({error: "unauthorized"});
    }

    return res.redirect("/login");
};

// local
// Dev-only auth wrapper.
// In development, we bypass real authentication and inject a fake user.
// In production, we still use the real ensureAuthenticated middleware.
const devSafeAuth = (req, res, next) => {
    const isDev = process.env.NODE_ENV !== "production";

    if (isDev) {
        if (!req.user) {
            req.user = {
                id: "dev-user-1",
                emails: [{value: "dev-student@ucsd.edu"}],
                role: "Student",
            };
        }
        return next();
    }

    // Production / staging: keep real auth behavior
    return ensureAuthenticated(req, res, next);
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
    const {blocked, attempts: recentAttempts} = await getLoginAttemptStatus(identifier);


    // --- Whitelist bypass for rate limits ---
    if (email) {
        const whitelistEntry = await Whitelist.findOne({where: {email}});
        if (whitelistEntry) {
            console.log(`[TRACE] Whitelisted user bypassing rate-limit: ${email}`);
            await clearLoginAttempts(identifier);
            await logAuthEvent("LOGIN_SUCCESS_WHITELIST_BYPASS", {
                req,
                message: "Whitelisted user bypassed rate-limit",
                userEmail: email,
                userId,
                metadata: {provider: "google"}
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
        return done(null, false, {message: "Too many failed login attempts. Please try again later."});
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
                metadata: {provider: "google"}
            });
            return done(null, profile);
        }

        // --- Step 2: Non-UCSD (gmail etc.) → check whitelist ---
        console.log(`🔐 Non-UCSD domain login successful email: ${email}`);
        if (email) {
            console.log(`[TRACE] Checking whitelist for email: ${email}`);
            const whitelistEntry = await Whitelist.findOne({where: {email}});
            if (whitelistEntry) {
                console.log(`[TRACE] Whitelist entry found for email: ${email}`);
                await clearLoginAttempts(identifier);
                await logAuthEvent("LOGIN_SUCCESS_WHITELIST", {
                    req,
                    message: "Whitelisted non-UCSD user allowed login",
                    userEmail: email,
                    userId,
                    metadata: {provider: "google"}
                });

                // ✅ Treat whitelisted users as 'Unregistered'
                console.log(`[TRACE] Creating or finding 'Unregistered' user for email: ${email}`);
                await User.findOrCreate({
                    where: {email},
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
        return done(null, false, {message: "Non-UCSD or unapproved account"});
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
        store: new RedisStore({client: redisClient}),
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

// Role-based dashboards
app.get("/student-dashboard", ensureAuthenticated, (req, res) => res.sendFile(buildFullViewPath("student-dashboard.html")));
app.get("/ta-dashboard", ensureAuthenticated, (req, res) => res.sendFile(buildFullViewPath("ta-dashboard.html")));
app.get("/faculty-dashboard", ensureAuthenticated, (req, res) => res.sendFile(buildFullViewPath("professor-dashboard.html")));
app.get("/admin-dashboard", ensureAuthenticated, (req, res) => res.sendFile(buildFullViewPath("admin-dashboard.html")));

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
        metadata: {query: req.query}
    });

    // Redirect user to blocked page with their email if available
    req.session.blockedEmail = attemptedEmail;
    res.redirect("/blocked.html");
});

// Always force account chooser on each login attempt
app.get("/auth/google", (req, res, next) => {
    req.logout(() => {
    });       // clear any cached user
    req.session?.destroy(() => {
    });  // destroy session

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
    passport.authenticate("google", {failureRedirect: "/auth/failure"}),
    async (req, res) => {
        const email = req.user?.emails?.[0]?.value || "unknown";

        try {
            // Debug logs
            console.log("🔐 New login detected:");
            console.log("   Session ID:", req.sessionID);
            console.log("   Logged-in user:", email);

            // Ensure user exists in DB (create as Unregistered by default)
            const [user] = await User.findOrCreate({
                where: {email},
                defaults: {
                    name: req.user.displayName,
                    user_type: "Unregistered",
                },
            });

            console.log("✅ Login success for:", email);

            await logAuthEvent("LOGIN_CALLBACK_SUCCESS", {
                req,
                message: "OAuth callback completed successfully",
                userEmail: email,
                userId: user.id,
                metadata: {provider: "google"},
            });

            // Redirect based on user type (use app routes, not file paths)
            switch (user.user_type) {
                case "Admin":
                    return res.redirect("/admin-dashboard");
                case "Professor":
                    return res.redirect("/faculty-dashboard");
                case "TA":
                case "Tutor":
                    return res.redirect("/ta-dashboard");
                case "Student":
                    return res.redirect("/student-dashboard");
                default:
                    return res.redirect("/register.html");
            }
        } catch (error) {
            console.error("Error in /auth/google/callback handler:", error);
            await logAuthEvent("LOGIN_CALLBACK_ERROR", {
                req,
                message: "Error handling OAuth callback",
                userEmail: email,
                metadata: {error: error?.message},
            });
            return res.redirect("/auth/failure");
        }
    }
);


// Failed login route
app.get("/auth/failure", async (req, res) => {
    console.warn("⚠️ Google OAuth failed or unauthorized user.");
    await logAuthEvent("LOGIN_FAILURE", {
        req,
        message: "Google OAuth failed or unauthorized user",
        metadata: {provider: "google"}
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


function buildFullViewPath(viewFileName) {
    return path.join(__dirname, `${VIEW_DIR}/${viewFileName}`)
}

// Reset any leftover session before showing login page
app.get("/login", (req, res) => {
    // Clear Passport user and Redis session if any
    try {
        if (req.logout) req.logout(() => {
        });
        if (req.session) req.session.destroy(() => {
        });
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

    req.logout((error) => {
        if (error) {
            logAuthEvent("LOGOUT_ERROR", {
                req,
                message: "Error encountered during logout",
                userEmail: email,
                userId,
                metadata: {error: error.message}
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
    req.logout(() => {
    });
    if (req.session) {
        req.session.destroy(() => {
            res.redirect("https://idp.ucsd.edu/idp/profile/Logout?return=https://localhost:8443/login");
        });
    } else {
        res.redirect("https://idp.ucsd.edu/idp/profile/Logout?return=https://localhost:8443/login");
    }
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

// ADD A Simple POST to register login
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.post("/register/submit", ensureAuthenticated, async (req, res) => {
    const email = req.user?.emails?.[0]?.value;
    const newRole = req.body.role;
    if (!email || !newRole) return res.status(400).send("Invalid request");

    await User.update({user_type: newRole}, {where: {email}});
    res.send(`<h2>✅ Role updated to ${newRole}. Please <a href="/auth/google">relogin</a>.</h2>`);
});

// --- START HTTPS SERVER ---
// const startServer = async () => {
//   try {
//     await sequelize.authenticate();
//     await sequelize.sync({ alter: true }); // create users table if missing
//     console.log("✅ Database connection established");
//   } catch (error) {
//     console.error("Failed to connect to the database", error);
//     process.exit(1);
//   }

//   if (HTTPS_AVAILABLE && sslOptions) {
//     https.createServer(sslOptions, app).listen(8443, () => {
//       console.log("✅ HTTPS server running at https://localhost:8443");
//     });
//   } else {
//     const PORT = process.env.PORT || 8080;
//     app.listen(PORT, () => {
//       console.log(`⚠️ HTTPS not available — running HTTP server at http://localhost:${PORT}`);
//     });
//   }
// };


// --- Access Request Submission ---
app.post("/request-access", async (req, res) => {
    const {email, reason} = req.body;
    if (!email) return res.status(400).send("Missing email");

    // Check if already approved (whitelisted)
    const whitelisted = await Whitelist.findOne({where: {email}});
    if (whitelisted) {
        return res.status(200).send(`<h3>✅ ${email} is already approved for access.</h3>`);
    }

    // Check if an access request already exists
    const existingRequest = await AccessRequest.findOne({where: {email}});
    if (existingRequest) {
        // ✅ Update the existing entry instead of skipping
        await existingRequest.update({reason, requested_at: new Date()});

        await logAuthEvent("ACCESS_REQUEST_UPDATED", {
            req,
            message: `Access request for ${email} was updated.`,
            userEmail: email,
            metadata: {reason}
        });

        return res.status(200).send(`<h3>🔄 Your previous request for ${email} has been updated successfully.</h3>`);
    }

    // ✅ Create a new request if it doesn’t exist
    await AccessRequest.create({email, reason});
    await logAuthEvent("ACCESS_REQUEST_SUBMITTED", {
        req,
        message: `Access request submitted by ${email}`,
        userEmail: email,
        metadata: {reason}
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
        where: {email},
        defaults: {approved_by: "Admin"}
    });
    if (!created) {
        console.log(`ℹ️ ${email} already exists in whitelist.`);
    }

    // Ensure matching user exists in users table
    await User.findOrCreate({
        where: {email},
        defaults: {
            name: email.split("@")[0],
            user_type: "Unregistered"
        }
    });

    await AccessRequest.destroy({where: {email}});
    res.redirect("/admin/whitelist");
});
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
    try {
        return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    } catch {
        return null;
    }
};

const requireInstructorOfCourse = async (req, res, next) => {
    const email = req.user?.emails?.[0]?.value;
    const courseId = Number.parseInt(req.params.courseId, 10);
    const cu = await CourseUser.findOne({
        where: {course_id: courseId},
        include: [{model: User, where: {email}}, {model: Course}]
    });
    if (!cu || (cu.role !== 'Professor' && cu.role !== 'TA' && cu.role !== 'Tutor')) {
        await logAuthEvent('COURSE_FORBIDDEN', {req, message: 'Not course staff', metadata: {courseId}});
        return res.status(403).json({error: 'forbidden'});
    }
    next();
};

// Create invites
app.post('/api/courses/:courseId/invites', ensureAuthenticated, requireInstructorOfCourse, express.json(), async (req, res) => {
    const {type, emails = [], role = 'Student'} = req.body; // type: 'ucsd'|'extension'|'staff'
    const courseId = Number.parseInt(req.params.courseId, 10);
    const creator = req.user?.emails?.[0]?.value;
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000);

    if (type === 'ucsd') {
        // Open UCSD link, not bound to email
        const payload = {courseId, kind: 'ucsd', role: 'Student', exp: expiresAt.getTime()};
        const token = signToken(payload);
        const invite = await Invite.create({
            course_id: courseId,
            email: null,
            role: 'Student',
            token,
            expires_at: expiresAt,
            created_by: creator,
            kind: 'ucsd',
            verified: true
        });
        return res.json({link: `/enroll/${invite.token}`});
    }

    // Email-bound invites (extension or staff)
    if (!Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({error: 'emails required'});
    }

    const results = [];
    for (const email of emails) {
        const payload = {
            courseId,
            kind: type === 'staff' ? 'staff' : 'extension',
            email,
            role: type === 'staff' ? role : 'Student',
            exp: expiresAt.getTime()
        };
        const token = signToken(payload);
        const invite = await Invite.create({
            course_id: courseId,
            email,
            role: payload.role,
            token,
            expires_at: expiresAt,
            created_by: creator,
            kind: payload.kind
        });
        // TODO: send email with `${BASE_URL}/enroll/${token}`
        results.push({email, link: `/enroll/${invite.token}`});
    }
    res.json({invites: results});
});

// Enroll via token
app.get('/enroll/:token', async (req, res) => {
    const {token} = req.params;
    const decoded = verifyToken(token);
    if (!decoded || !decoded.exp || decoded.exp < Date.now()) {
        await logAuthEvent('INVITE_INVALID', {req, message: 'Invalid or expired token'});
        return res.status(400).send('Invalid invite');
    }

    const invite = await Invite.findOne({where: {token}});
    if (!invite) return res.status(400).send('Invalid invite');

    // Require auth; if not logged in, bounce to google with return
    if (!(req.isAuthenticated && req.isAuthenticated())) {
        req.session.nextAfterLogin = `/enroll/${token}`;
        return res.redirect(`/auth/google?next=${encodeURIComponent(`/enroll/${token}`)}`);
    }

    const email = req.user?.emails?.[0]?.value;

    if (decoded.kind === 'ucsd') {
        if (!email?.endsWith('@ucsd.edu')) {
            await logAuthEvent('ENROLL_REJECTED_DOMAIN', {req, message: 'Non-UCSD attempted UCSD link'});
            return res.status(403).send('UCSD account required');
        }
    } else {
        // extension/staff invites must match email
        if (decoded.email?.toLowerCase() !== email?.toLowerCase()) {
            await logAuthEvent('INVITE_EMAIL_MISMATCH', {req, message: 'Invite email mismatch', userEmail: email});
            return res.status(403).send('Invite not issued to this email');
        }
    }

    // Enroll
    const {courseId} = decoded;
    const [userRecord] = await User.findOrCreate({
        where: {email},
        defaults: {name: req.user.displayName || null, user_type: 'Student'}
    });
    await CourseUser.findOrCreate({
        where: {course_id: courseId, user_id: userRecord.id},
        defaults: {course_id: courseId, user_id: userRecord.id, role: decoded.role || 'Student'}
    });
    await Invite.update({verified: true, accepted_at: new Date()}, {where: {id: invite.id}});
    await logAuthEvent('ENROLL_SUCCESS', {
        req,
        message: 'Enrollment success',
        userEmail: email,
        metadata: {courseId, kind: decoded.kind}
    });

    // Redirect by role to dashboard
    const role = decoded.role || 'Student';
    if (role === 'TA' || role === 'Tutor') return res.redirect('/ta-dashboard');
    if (role === 'Professor') return res.redirect('/professor-dashboard');
    return res.redirect('/student-dashboard');
});


// -------------------- CLASS DIRECTORY: USER CARDS APIs --------------------

// Helper: get logged-in user row (can be reused later if needed)
const getCurrentUserRecord = async (req) => {
    const email = req.user?.emails?.[0]?.value;
    if (!email) return null;
    return await User.findOne({where: {email}});
};

// GET /api/class/:courseId/professor
// Returns the list of professors for a given course (based on course_users.role = 'Professor')
app.get("/api/class/:courseId/professor", devSafeAuth, async (req, res) => {
    const courseId = Number.parseInt(req.params.courseId, 10);
    if (!Number.isFinite(courseId)) {
        return res.status(400).json({error: "invalid_course_id"});
    }

    try {
        const memberships = await CourseUser.findAll({
            where: {course_id: courseId, role: "Professor"},
            include: [User],
        });

        const professors = memberships.map((m) => ({
            userId: m.User.id,
            name: m.User.name,
            preferredName: m.User.name || null, // Currently we only have "name" on User
            pronouns: null,                      // TODO: add real field when schema is extended
            photo: null,                         // TODO: add avatar field in User
            email: m.User.email,
            phone: null,
            links: {
                linkedin: null,
                github: null,
                office_hours: null,
                class_chat: null,
            },
            availability: [],                    // TODO: join availability table in the future
        }));

        return res.json({
            offeringId: courseId,
            professors,
        });
    } catch (err) {
        console.error("Error in GET /api/class/:courseId/professor", err);

        // Development-only fallback: return mock data if DB is not reachable.
        if (process.env.NODE_ENV === "development") {
            return res.json({
                offeringId: courseId,
                professors: [
                    {
                        userId: "mock-prof-1",
                        name: "John Smith",
                        preferredName: "John",
                        pronouns: "he/him",
                        photo: null,
                        email: "jsmith@ucsd.edu",
                        phone: null,
                        links: {
                            linkedin: "https://www.linkedin.com/in/john-smith",
                            github: "https://github.com/john-smith",
                            office_hours: null,
                            class_chat: null,
                        },
                        availability: [],
                    },
                ],
            });
        }

        return res.status(500).json({error: "internal_error"});
    }
});

// GET /api/class/:courseId/tas
// Returns all TAs for a given course (course_users.role = 'TA')
app.get("/api/class/:courseId/tas", devSafeAuth, async (req, res) => {
    const courseId = Number.parseInt(req.params.courseId, 10);
    if (!Number.isFinite(courseId)) {
        return res.status(400).json({error: "invalid_course_id"});
    }

    try {
        const memberships = await CourseUser.findAll({
            where: {course_id: courseId, role: "TA"},
            include: [User],
        });

        const tas = memberships.map((m) => ({
            userId: m.User.id,
            name: m.User.name,
            preferredName: m.User.name || null,
            pronouns: null,
            photo: null,
            email: m.User.email,
            section: null, // TODO: when you add a section column to CourseUser, populate it here
            role: "TA",
            links: {
                linkedin: null,
                github: null,
                class_chat: null,
            },
            availability: [],
            activity: null,
        }));

        return res.json({
            offeringId: courseId,
            tas,
        });
    } catch (err) {
        console.error("Error in GET /api/class/:courseId/tas", err);

        if (process.env.NODE_ENV === "development") {
            return res.json({
                offeringId: courseId,
                tas: [
                    {
                        userId: "mock-ta-1",
                        name: "Alice Chen",
                        preferredName: "Alice",
                        pronouns: "she/her",
                        photo: null,
                        email: "alice@ucsd.edu",
                        section: "A01",
                        role: "TA",
                        links: {
                            linkedin: "https://www.linkedin.com/in/alice-chen",
                            github: "https://github.com/alice-chen",
                            class_chat: null,
                        },
                        availability: [],
                        activity: null,
                    },
                ],
            });
        }

        return res.status(500).json({error: "internal_error"});
    }
});

// GET /api/class/ta/:taId
// Returns a single TA profile by user id (does not validate which course they belong to)
app.get("/api/class/ta/:taId", devSafeAuth, async (req, res) => {
    const taId = Number.parseInt(req.params.taId, 10);
    if (!Number.isFinite(taId)) {
        return res.status(400).json({error: "invalid_user_id"});
    }

    try {
        const user = await User.findByPk(taId);
        if (!user) {
            return res.status(404).json({error: "ta_not_found"});
        }

        const taInfo = {
            userId: user.id,
            name: user.name,
            preferredName: user.name || null,
            pronouns: null,
            photo: null,
            email: user.email,
            section: null, // TODO: can be populated via CourseUser if needed
            role: "TA",    // This is just the card role label
            links: {
                linkedin: null,
                github: null,
                class_chat: null,
            },
            availability: [],
            activity: null,
        };

        return res.json(taInfo);
    } catch (err) {
        console.error("Error in GET /api/class/ta/:taId", err);

        if (process.env.NODE_ENV === "development") {
            return res.json({
                userId: taId,
                name: "Alice Chen",
                preferredName: "Alice",
                pronouns: "she/her",
                photo: null,
                email: "alice@ucsd.edu",
                section: "A01",
                role: "TA",
                links: {
                    linkedin: "https://www.linkedin.com/in/alice-chen",
                    github: "https://github.com/alice-chen",
                    class_chat: null,
                },
                availability: [],
                activity: null,
            });
        }

        return res.status(500).json({error: "internal_error"});
    }
});

// GET /api/class/:courseId/students
// Returns students in a given course, with basic pagination and optional search
app.get("/api/class/:courseId/students", devSafeAuth, async (req, res) => {
    const courseId = Number.parseInt(req.params.courseId, 10);
    if (!Number.isFinite(courseId)) {
        return res.status(400).json({error: "invalid_course_id"});
    }

    const {section, search, group, page = 1, limit = 20} = req.query;
    const pageNum = Number.parseInt(page, 10) || 1;
    const limitNum = Number.parseInt(limit, 10) || 20;
    const offset = (pageNum - 1) * limitNum;

    try {
        const whereMembership = {
            course_id: courseId,
            role: "Student",
        };

        // Currently CourseUser does not have section/group columns.
        // Once you extend the schema you can add filters here, e.g.:
        // if (section) whereMembership.section = section;
        // if (group) whereMembership.group = group;

        const {rows, count} = await CourseUser.findAndCountAll({
            where: whereMembership,
            include: [User],
            offset,
            limit: limitNum,
        });

        // In-memory filter for search across name and email
        const filtered = rows.filter((m) => {
            if (!search) return true;
            const q = search.toLowerCase();
            const name = (m.User.name || "").toLowerCase();
            const email = (m.User.email || "").toLowerCase();
            return name.includes(q) || email.includes(q);
        });

        const students = filtered.map((m) => ({
            userId: m.User.id,
            name: m.User.name,
            preferredName: m.User.name || null,
            pronouns: null,
            photo: null,
            email: m.User.email,
            section: null, // TODO: populate from CourseUser in the future
            role: "STUDENT",
            links: {
                github: null,
                linkedin: null,
            },
            attendance: {
                lectures: 0, // TODO: integrate real attendance data here
                meetings: 0,
                officeHours: 0,
            },
            activity: {
                punchCard: [],
            },
        }));

        return res.json({
            offeringId: courseId,
            students,
            page: pageNum,
            limit: limitNum,
            total: count,
        });
    } catch (err) {
        console.error("Error in GET /api/class/:courseId/students", err);

        if (process.env.NODE_ENV === "development") {
            return res.json({
                offeringId: courseId,
                students: [
                    {
                        userId: "mock-student-1",
                        name: "Andy Cheng",
                        preferredName: "Andy",
                        pronouns: "he/him",
                        photo: null,
                        email: "andy@ucsd.edu",
                        section: "A02",
                        role: "STUDENT",
                        links: {
                            github: "https://github.com/andy-cheng",
                            linkedin: "https://www.linkedin.com/in/andy-cheng",
                        },
                        attendance: {
                            lectures: 12,
                            meetings: 4,
                            officeHours: 1,
                        },
                        activity: {
                            punchCard: [],
                        },
                    },
                ],
                page: pageNum,
                limit: limitNum,
                total: 1,
            });
        }

        return res.status(500).json({error: "internal_error"});
    }
});

// // My courses endpoint
// app.get('/api/my-courses', ensureAuthenticated, async (req, res) => {
//   const email = req.user?.emails?.[0]?.value;
//   const userRecord = await User.findOne({ where: { email } });
//   if (!userRecord) return res.json({ courses: [] });
//   const memberships = await CourseUser.findAll({ where: { user_id: userRecord.id }, include: [Course] });
//   const courses = memberships.map(m => ({ id: m.Course.id, code: m.Course.code, title: m.Course.title, role: m.role }));
//   res.json({ courses });
// });

// startServer();
// --- My courses endpoint (define route first) ---
app.get('/api/my-courses', ensureAuthenticated, async (req, res) => {
    const email = req.user?.emails?.[0]?.value;
    const userRecord = await User.findOne({where: {email}});

    if (!userRecord) {
        return res.json({courses: []});
    }

    const memberships = await CourseUser.findAll({
        where: {user_id: userRecord.id},
        include: [Course],
    });

    const courses = memberships.map((m) => ({
        id: m.Course.id,
        code: m.Course.code,
        title: m.Course.title,
        role: m.role,
    }));

    res.json({courses});
});


// --- Start Server (LOCAL DEV: skip DB connection) ---
const startServer = async () => {
    console.log("NODE_ENV =", process.env.NODE_ENV);

    console.warn(
        "⚠️ Skipping sequelize.authenticate() / sequelize.sync() in LOCAL DEV. " +
        "Any route that touches the database may still throw runtime errors."
    );

    if (HTTPS_AVAILABLE && sslOptions) {
        https.createServer(sslOptions, app).listen(8443, () => {
            console.log("✅ HTTPS server running at https://localhost:8443");
        });
    } else {
        const PORT = process.env.PORT || 8080;
        app.listen(PORT, () => {
            console.log(
                `⚠️ HTTPS not available — running HTTP server at http://localhost:${PORT}`
            );
        });
    }
};

registerGroupApis(app, {authMiddleware: devSafeAuth, models: {User, Team, TeamMember}});
registerClassApis(app, {
    authMiddleware: devSafeAuth,
    models: {Course: CourseOffering, CourseUser, User}
});
startServer().catch((err) => {
    console.error("Unexpected error in startServer:", err);
});
