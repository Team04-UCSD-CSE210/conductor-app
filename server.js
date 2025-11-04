import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import cors from 'cors';
import dotenv from 'dotenv';
import { createSequelize } from './src/database.js';
import { defineAuthLogModel } from './src/models/auth-log.js';

dotenv.config();

const {
  NODE_ENV,
  PORT,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
  ALLOWED_GOOGLE_DOMAIN,
  ALLOWED_ORIGINS,
  SESSION_SECRET,
  SESSION_SAME_SITE,
  SESSION_SECURE,
  SESSION_COOKIE_DOMAIN,
  SUCCESS_REDIRECT_URL,
  FAILURE_REDIRECT_URL,
  DATABASE_URL,
  PGSSLMODE,
  LOGIN_FAILURE_THRESHOLD,
  LOGIN_FAILURE_WINDOW_MINUTES
} = process.env;

const createLogger = () => {
  const format = (level, message, meta = {}) => {
    const payload = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${payload}`;
  };

  return {
    info: (message, meta) => {
      console.log(format('info', message, meta));
    },
    warn: (message, meta) => {
      console.warn(format('warn', message, meta));
    },
    error: (message, meta) => {
      console.error(format('error', message, meta));
    }
  };
};

const logger = createLogger();

const requiredEnvVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'SESSION_SECRET',
  'DATABASE_URL'
];

const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  const message = `Missing required environment variables: ${missingEnvVars.join(', ')}`;
  logger.error(message);
  throw new Error(message);
}

const sequelize = createSequelize({
  databaseUrl: DATABASE_URL,
  sslMode: PGSSLMODE
});

const AuthLog = defineAuthLogModel(sequelize);

const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    await AuthLog.sync();
    logger.info('Database connection established');
  } catch (error) {
    logger.error('Failed to initialize database', { error: error.message });
    throw error;
  }
};

const persistAuditLog = async (eventType, message, meta = {}) => {
  const metadata = { ...meta };
  const email = metadata.email ?? null;
  const ip = metadata.ip ?? null;
  const path = metadata.path ?? null;
  const userId = metadata.userId ?? null;

  delete metadata.email;
  delete metadata.ip;
  delete metadata.path;
  delete metadata.userId;

  const metadataPayload = Object.keys(metadata).length > 0 ? metadata : {};

  await AuthLog.create({
    eventType,
    message: message ?? null,
    userEmail: email,
    ipAddress: ip,
    userId,
    path,
    metadata: metadataPayload
  });
};

const auditLog = (level, eventType, message, meta = {}) => {
  logger[level](message, meta);
  persistAuditLog(eventType, message, meta).catch((error) => {
    logger.error('Failed to persist audit log', {
      error: error.message,
      eventType
    });
  });
};

const app = express();
const port = Number(PORT) || 3000;
const allowedDomain = (ALLOWED_GOOGLE_DOMAIN || 'ucsd.edu').toLowerCase();
const isProduction = NODE_ENV === 'production';
const isSecureCookie = SESSION_SECURE === 'true' || isProduction;
const sameSitePolicy = SESSION_SAME_SITE || (isSecureCookie ? 'none' : 'lax');

const allowedOrigins = ALLOWED_ORIGINS
  ? ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

const parsePositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const loginFailureThreshold = parsePositiveNumber(LOGIN_FAILURE_THRESHOLD, 5);
const loginFailureWindowMinutes = parsePositiveNumber(LOGIN_FAILURE_WINDOW_MINUTES, 15);
const loginFailureWindowMs = loginFailureWindowMinutes * 60 * 1000;

const loginFailureTracker = new Map();

const getFailureKey = ({ email, ip }) => {
  if (email) {
    return `email:${email}`;
  }

  return `ip:${ip}`;
};

const recordLoginFailure = ({ email, ip, reason, path }) => {
  const now = Date.now();
  const key = getFailureKey({ email, ip });
  const entry = loginFailureTracker.get(key) || { attempts: [], lastAlertAt: 0 };
  entry.attempts = entry.attempts.filter((timestamp) => now - timestamp < loginFailureWindowMs);
  entry.attempts.push(now);
  const attempts = entry.attempts.length;

  auditLog('warn', 'login_failure', 'Login attempt failed', {
    email: email || null,
    ip,
    attempts,
    reason,
    path
  });

  if (attempts >= loginFailureThreshold && now - entry.lastAlertAt >= loginFailureWindowMs) {
    entry.lastAlertAt = now;
    auditLog('warn', 'login_failure_alert', 'Excessive login failures detected', {
      email: email || null,
      ip,
      attempts,
      threshold: loginFailureThreshold,
      windowMinutes: loginFailureWindowMinutes,
      path
    });
  }

  loginFailureTracker.set(key, entry);
};

const clearLoginFailures = ({ email, ip }) => {
  const key = getFailureKey({ email, ip });
  if (loginFailureTracker.has(key)) {
    loginFailureTracker.delete(key);
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'DELETE']
}));

app.use(express.json());

const sessionCookieConfig = {
  httpOnly: true,
  sameSite: sameSitePolicy,
  secure: isSecureCookie,
  maxAge: 24 * 60 * 60 * 1000,
  path: '/'
};

if (SESSION_COOKIE_DOMAIN) {
  sessionCookieConfig.domain = SESSION_COOKIE_DOMAIN;
}

app.use(session({
  name: 'conductor.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: sessionCookieConfig
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(new GoogleStrategy(
  {
    passReqToCallback: true,
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL
  },
  (req, _accessToken, _refreshToken, profile, done) => {
    const email = profile.emails?.[0]?.value?.toLowerCase();

    if (!email) {
      done(null, false, {
        message: 'No email address returned from Google',
        email: null,
        reasonCode: 'missing_email',
        ip: req.ip
      });
      return;
    }

    if (!email.endsWith(`@${allowedDomain}`)) {
      done(null, false, {
        message: `Account must belong to ${allowedDomain}`,
        email,
        reasonCode: 'unauthorized_domain',
        ip: req.ip
      });
      return;
    }

    done(null, {
      id: profile.id,
      displayName: profile.displayName,
      email,
      photo: profile.photos?.[0]?.value ?? null
    });
  }
));

app.use(passport.initialize());
app.use(passport.session());

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    auditLog('info', 'private_route_access', 'Private route accessed', {
      path: req.path,
      method: req.method,
      email: req.user?.email ?? null,
      ip: req.ip
    });
    next();
    return;
  }

  auditLog('warn', 'private_route_denied', 'Unauthorized access blocked', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  res.status(401).json({ error: 'Not authenticated' });
};

const successRedirect = SUCCESS_REDIRECT_URL || '/auth/success';
const failureRedirect = FAILURE_REDIRECT_URL || '/auth/failure';

app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account',
  hd: allowedDomain
}));

app.get(
  '/auth/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { failureMessage: true }, (err, user, info) => {
      if (err) {
        auditLog('error', 'oauth_callback_error', 'OAuth callback error', {
          error: err.message,
          ip: req.ip,
          path: req.path
        });
        next(err);
        return;
      }

      if (!user) {
        if (info?.message && req.session) {
          req.session.messages = Array.isArray(req.session.messages) ? req.session.messages : [];
          req.session.messages.push(info.message);
        }

        recordLoginFailure({
          email: info?.email ?? null,
          ip: info?.ip ?? req.ip,
          reason: info?.message ?? 'Authentication failed',
          path: req.path
        });
        res.redirect(failureRedirect);
        return;
      }

      req.logIn(user, (loginError) => {
        if (loginError) {
          auditLog('error', 'login_session_error', 'Session establishment failed', {
            error: loginError.message,
            email: user.email,
            ip: req.ip,
            path: req.path
          });
          next(loginError);
          return;
        }

        clearLoginFailures({ email: user.email, ip: req.ip });
        if (req.session && Array.isArray(req.session.messages)) {
          delete req.session.messages;
        }
        auditLog('info', 'login_success', 'User logged in', {
          email: user.email,
          ip: req.ip,
          userId: user.id
        });
        res.redirect(successRedirect);
      });
    })(req, res, next);
  }
);

app.get('/auth/success', ensureAuthenticated, (req, res) => {
  res.json({
    user: req.user
  });
});

app.get('/auth/failure', (req, res) => {
  const message = Array.isArray(req.session?.messages) && req.session.messages.length > 0
    ? req.session.messages[req.session.messages.length - 1]
    : 'Unable to authenticate.';

  auditLog('warn', 'login_failure_response', 'Login failure endpoint accessed', {
    ip: req.ip,
    message
  });

  res.status(401).json({ error: message });
});

app.get('/api/auth/status', (req, res) => {
  const authenticated = Boolean(req.isAuthenticated && req.isAuthenticated());

  logger.info('Auth status requested', {
    email: authenticated ? req.user.email : null,
    ip: req.ip,
    authenticated
  });

  res.json({
    authenticated,
    user: authenticated ? req.user : null
  });
});

app.post('/auth/logout', (req, res, next) => {
  const userEmail = req.user?.email ?? null;

  if (!req.user) {
    auditLog('warn', 'logout_without_session', 'Logout requested without active session', {
      ip: req.ip
    });
  }

  req.logout((logoutError) => {
    if (logoutError) {
      next(logoutError);
      return;
    }

    req.session.destroy((sessionError) => {
      if (sessionError) {
        next(sessionError);
        return;
      }

      const clearCookieOptions = {
        path: sessionCookieConfig.path,
        sameSite: sessionCookieConfig.sameSite,
        secure: sessionCookieConfig.secure
      };

      if (sessionCookieConfig.domain) {
        clearCookieOptions.domain = sessionCookieConfig.domain;
      }

      res.clearCookie('conductor.sid', clearCookieOptions);
      auditLog('info', 'logout_success', 'User logged out', {
        email: userEmail,
        ip: req.ip
      });
      res.status(204).send();
    });
  });
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack
  });

  if (err.message === 'Origin not allowed by CORS') {
    res.status(403).json({ error: err.message });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
});

const startServer = async () => {
  await initializeDatabase();
  app.listen(port, () => {
    logger.info(`Conductor server listening on port ${port}`);
  });
};

startServer().catch((error) => {
  logger.error('Failed to start server', { error: error.message });
  process.exit(1);
});
