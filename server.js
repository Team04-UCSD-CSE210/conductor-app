import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import path from "path";
import https from "https";
import fs from "fs";
import { fileURLToPath } from "url";
import { trackLoginAttempt, isBlocked } from "./js/middleware/loginAttemptTracker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SSL certificate and key
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, "certs", "server.key")),
  cert: fs.readFileSync(path.join(__dirname, "certs", "server.crt")),
};

const app = express();

// -------------------- CONFIG --------------------
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const CALLBACK_URL = "https://localhost:8443/auth/google/callback";

// -------------------- PASSPORT --------------------
passport.use(new GoogleStrategy({
  clientID: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  callbackURL: CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
  // Restrict to UCSD email addresses only
  if (profile._json.hd === "ucsd.edu") return done(null, profile);
  return done(new Error("Non-UCSD account"));
}));

console.log("✅ OAuth callback configured for:", CALLBACK_URL);


passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

import { createClient } from "redis";
import { RedisStore } from "connect-redis";

const redisClient = createClient({ url: "redis://localhost:6379" });
redisClient.connect().catch(console.error);

app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: "strict",
      maxAge: 30 * 60 * 1000,
    },
  })
);



// -------------------- MIDDLEWARE --------------------
app.use(passport.initialize());
app.use(passport.session());

// serve all your static files (HTML, CSS, JS, etc.)
app.use(express.static(__dirname));
// Serve blocked page
app.get("/blocked", (req, res) => {
  res.sendFile(path.join(__dirname, "blocked.html"));
});



// -------------------- ROUTES --------------------
app.get("/auth/google", (req, res, next) => {
  console.log("🔄 Redirecting to Google with callback:", CALLBACK_URL);
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});


app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/failure" }),
  (req, res) => {
    const email = req.user?.emails?.[0]?.value || "unknown";
    console.log("✅ Login success for:", email);
    res.redirect("/dashboard.html");
  }
);

// Failed login route
app.get("/auth/failure", (req, res) => {
  console.warn("⚠️ Google OAuth failed or unauthorized user.");
  res.redirect("/blocked.html");
});


app.get("/api/user", (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "unauthorized" });
  res.json({
    name: req.user.displayName,
    email: req.user.emails[0].value,
    picture: req.user.photos[0].value
  });
});

app.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/login.html"));
});

// HTTP --> HTTPS
app.use((req, res, next) => {
  if (!req.secure) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});


// --- START HTTPS SERVER ---
https.createServer(sslOptions, app).listen(8443, () => {
  console.log("✅ HTTPS server running at https://localhost:8443");
});
