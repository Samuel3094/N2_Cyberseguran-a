const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

const JWT_OPTIONS = { issuer: 'assinatura-digital-api', audience: 'assinatura-digital-web' };

function csrfFor(jti) {
  return crypto.createHmac('sha256', config.csrfSecret).update(jti).digest('hex');
}

// Emite o JWT e o token anti-CSRF vinculado a ele (jti)
function issueTokens(user) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, config.jwtSecret, {
    ...JWT_OPTIONS,
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn,
    jwtid: jti,
  });
  return { token, csrfToken: csrfFor(jti) };
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Não autenticado' });

  try {
    // Algoritmo fixo: impede ataques "alg: none" / troca de algoritmo
    const payload = jwt.verify(token, config.jwtSecret, { ...JWT_OPTIONS, algorithms: ['HS256'] });
    const user = await User.findById(payload.sub);
    if (!user || !user.active) return res.status(401).json({ error: 'Usuário inativo ou inexistente' });
    req.user = { id: user._id.toString(), role: user.role, name: user.name, email: user.email, doc: user };
    req.tokenId = payload.jti;
    return next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado para o seu perfil' });
    }
    return next();
  };
}

// Proteção CSRF: requisições que alteram estado precisam do cabeçalho X-CSRF-Token
// igual ao HMAC do id da sessão (padrão "synchronizer token" sem estado).
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = String(req.headers['x-csrf-token'] || '');
  const expected = csrfFor(req.tokenId || '');
  const ok =
    sent.length === expected.length && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
  if (!ok) return res.status(403).json({ error: 'Token CSRF inválido' });
  return next();
}

module.exports = { issueTokens, authenticate, authorize, csrfProtection };
