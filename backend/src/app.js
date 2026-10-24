const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // necessário atrás de proxy HTTPS (Render, Railway, nginx)

// Cabeçalhos HTTP de segurança (Helmet): CSP, HSTS, X-Frame-Options, noSniff, Referrer-Policy...
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // o frontend (GH Pages) baixa recibos
    referrerPolicy: { policy: 'no-referrer' },
  })
);

// CORS restrito às origens do frontend
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      return cb(Object.assign(new Error('Origem não permitida pelo CORS'), { status: 403 }));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    maxAge: 600,
  })
);

app.use(rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(mongoSanitize({ replaceWith: '_' })); // bloqueia injeção NoSQL ($gt, $ne, ...)
app.use(hpp()); // bloqueia poluição de parâmetros HTTP
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/keys', require('./routes/keys'));
app.use('/api/expenses', require('./routes/expenses'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
