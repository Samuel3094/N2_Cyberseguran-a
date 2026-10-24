const express = require('express');
const { body } = require('express-validator');
const User = require('../models/User');
const { authenticate, authorize, csrfProtection } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { assertValidPublicKey, fingerprint, getServerKeys } = require('../services/crypto');
const { audit } = require('../services/audit');

const router = express.Router();

// Chave pública do servidor (para o cliente verificar o carimbo de tempo)
router.get('/server', async (req, res, next) => {
  try {
    const { publicKey } = await getServerKeys();
    res.json({ publicKey, algorithm: 'ECDSA_P256_SHA256' });
  } catch (err) {
    next(err);
  }
});

router.use(authenticate, csrfProtection);

// Retorna a chave do usuário logado (pública + envelope cifrado da privada)
router.get('/me', async (req, res) => {
  const { signingKey } = req.user.doc;
  if (!signingKey || !signingKey.publicKey) return res.json({ key: null });
  return res.json({
    key: {
      publicKey: signingKey.publicKey,
      fingerprint: signingKey.fingerprint,
      encryptedPrivateKey: signingKey.encryptedPrivateKey,
      createdAt: signingKey.createdAt,
    },
  });
});

const b64 = /^[A-Za-z0-9+/]+={0,2}$/;

// RN07: somente SUPERVISOR e GERENTE possuem chave de assinatura
router.post(
  '/',
  authorize('SUPERVISOR', 'GERENTE'),
  body('publicKey').isString().isLength({ max: 400 }).matches(b64),
  body('encryptedPrivateKey.ciphertext').isString().isLength({ max: 1000 }).matches(b64),
  body('encryptedPrivateKey.iv').isString().isLength({ max: 40 }).matches(b64),
  body('encryptedPrivateKey.salt').isString().isLength({ max: 60 }).matches(b64),
  body('encryptedPrivateKey.iterations').isInt({ min: 100000, max: 5000000 }).toInt(),
  handleValidation,
  async (req, res, next) => {
    try {
      const { publicKey, encryptedPrivateKey } = req.body;
      assertValidPublicKey(publicKey);
      const fp = fingerprint(publicKey);
      const user = await User.findById(req.user.id);

      // RN08: gerar nova chave revoga a anterior (assinaturas antigas continuam verificáveis)
      const now = new Date();
      for (const k of user.keyHistory) if (!k.revokedAt) k.revokedAt = now;
      user.keyHistory.push({ publicKey, fingerprint: fp, createdAt: now });
      user.signingKey = {
        publicKey,
        fingerprint: fp,
        encryptedPrivateKey: {
          ciphertext: encryptedPrivateKey.ciphertext,
          iv: encryptedPrivateKey.iv,
          salt: encryptedPrivateKey.salt,
          iterations: encryptedPrivateKey.iterations,
        },
        createdAt: now,
      };
      await user.save();
      await audit(req, 'CHAVE_REGISTRADA', user._id, { fingerprint: fp });
      res.status(201).json({ fingerprint: fp });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
