const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const config = require('../config');
const User = require('../models/User');
const { issueTokens, authenticate, csrfProtection } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { audit } = require('../services/audit');

const router = express.Router();

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;
const BCRYPT_ROUNDS = 12;
// Hash fictício: mantém o tempo de resposta igual quando o e-mail não existe (evita enumeração)
const DUMMY_HASH = bcrypt.hashSync('senha-ficticia-para-tempo-constante', BCRYPT_ROUNDS);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true, // conta apenas tentativas que falharam
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});

router.post(
  '/login',
  loginLimiter,
  body('email').isEmail().withMessage('E-mail inválido').trim().toLowerCase(),
  body('password').isString().isLength({ min: 1, max: 128 }).withMessage('Senha obrigatória'),
  handleValidation,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email: String(email) }).select('+passwordHash +failedLogins +lockUntil');
      const genericError = { error: 'E-mail ou senha incorretos' };

      if (!user) {
        await bcrypt.compare(password, DUMMY_HASH);
        await audit(req, 'LOGIN_FALHA', email);
        return res.status(401).json(genericError);
      }
      // RN02: conta bloqueada temporariamente após tentativas inválidas
      if (user.lockUntil && user.lockUntil > new Date()) {
        await audit(req, 'LOGIN_BLOQUEADO', user._id);
        return res.status(423).json({ error: 'Conta bloqueada temporariamente. Tente mais tarde.' });
      }
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok || !user.active) {
        user.failedLogins = (user.failedLogins || 0) + 1;
        if (user.failedLogins >= config.rules.maxFailedLogins) {
          user.lockUntil = new Date(Date.now() + config.rules.lockMinutes * 60 * 1000);
          user.failedLogins = 0;
        }
        await user.save();
        await audit(req, 'LOGIN_FALHA', user._id);
        return res.status(401).json(genericError);
      }

      user.failedLogins = 0;
      user.lockUntil = null;
      await user.save();
      req.user = { id: user._id.toString() };
      await audit(req, 'LOGIN_SUCESSO', user._id);
      return res.json({ ...issueTokens(user), user: user.toPublic() });
    } catch (err) {
      return next(err);
    }
  }
);

router.get('/me', authenticate, (req, res) => res.json({ user: req.user.doc.toPublic() }));

router.post(
  '/change-password',
  authenticate,
  csrfProtection,
  body('currentPassword').isString().notEmpty(),
  body('newPassword')
    .matches(PASSWORD_POLICY)
    .withMessage('A nova senha deve ter 8+ caracteres com maiúscula, minúscula, número e símbolo'),
  handleValidation,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id).select('+passwordHash');
      if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) {
        return res.status(400).json({ error: 'Senha atual incorreta' });
      }
      user.passwordHash = await bcrypt.hash(req.body.newPassword, BCRYPT_ROUNDS);
      await user.save();
      await audit(req, 'SENHA_ALTERADA', user._id);
      return res.json({ message: 'Senha alterada com sucesso' });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
module.exports.PASSWORD_POLICY = PASSWORD_POLICY;
module.exports.BCRYPT_ROUNDS = BCRYPT_ROUNDS;
