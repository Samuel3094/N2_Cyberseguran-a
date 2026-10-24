const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const User = require('../models/User');
const { ROLES } = require('../models/User');
const { authenticate, authorize, csrfProtection } = require('../middleware/auth');
const { handleValidation, validId, stripTags } = require('../middleware/validate');
const { PASSWORD_POLICY, BCRYPT_ROUNDS } = require('./auth');
const { audit } = require('../services/audit');
const { sendMail } = require('../services/mailer');
const config = require('../config');

const router = express.Router();
router.use(authenticate, csrfProtection, authorize('GERENTE'));

// Validação de CPF (dígitos verificadores) - RN03
function isValidCpf(raw) {
  const cpf = String(raw).replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

const employeeRules = (isCreate) => [
  body('name').trim().isLength({ min: 3, max: 120 }).withMessage('Nome deve ter de 3 a 120 caracteres').customSanitizer(stripTags),
  body('email').isEmail().withMessage('E-mail inválido').trim().toLowerCase(),
  body('department').optional().trim().isLength({ max: 80 }).customSanitizer(stripTags),
  body('position').optional().trim().isLength({ max: 80 }).customSanitizer(stripTags),
  body('role').isIn(ROLES).withMessage('Perfil inválido'),
  ...(isCreate
    ? [
        body('cpf').custom(isValidCpf).withMessage('CPF inválido').customSanitizer((v) => String(v).replace(/\D/g, '')),
        body('password').matches(PASSWORD_POLICY).withMessage('Senha deve ter 8+ caracteres com maiúscula, minúscula, número e símbolo'),
      ]
    : [body('active').optional().isBoolean().toBoolean()]),
];

router.get('/', async (req, res, next) => {
  try {
    const users = await User.find().sort({ name: 1 });
    res.json({ employees: users.map((u) => u.toPublic()) });
  } catch (err) {
    next(err);
  }
});

router.post('/', employeeRules(true), handleValidation, async (req, res, next) => {
  try {
    const { name, email, cpf, department, position, role, password } = req.body;
    const user = await User.create({
      name,
      email,
      cpf,
      department,
      position,
      role,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    });
    await audit(req, 'FUNCIONARIO_CRIADO', user._id, { role });
    sendMail({
      to: user.email,
      subject: 'Bem-vindo ao sistema de Assinatura Digital',
      lines: [
        `Olá, ${user.name}.`,
        `Sua conta foi criada com o perfil ${role}. A senha inicial será informada pelo seu gestor.`,
        'Recomendamos alterá-la no primeiro acesso.',
      ],
      link: `${config.frontendUrl}/login/`,
    });
    res.status(201).json({ employee: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', validId, employeeRules(false), handleValidation, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Funcionário não encontrado' });
    // RN04: o gerente não pode rebaixar nem desativar a si mesmo (evita perda de administração)
    if (user._id.toString() === req.user.id && (req.body.role !== 'GERENTE' || req.body.active === false)) {
      return res.status(400).json({ error: 'Você não pode alterar seu próprio perfil ou desativar sua conta' });
    }
    const fields = ['name', 'email', 'department', 'position', 'role', 'active'];
    for (const f of fields) if (req.body[f] !== undefined) user[f] = req.body[f];
    await user.save();
    await audit(req, 'FUNCIONARIO_ATUALIZADO', user._id, { role: user.role, active: user.active });
    return res.json({ employee: user.toPublic() });
  } catch (err) {
    return next(err);
  }
});

// Exclusão lógica: documentos assinados precisam continuar verificáveis (não repúdio)
router.delete('/:id', validId, async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Você não pode desativar a si mesmo' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Funcionário não encontrado' });
    user.active = false;
    if (user.signingKey && user.signingKey.fingerprint) {
      const hist = user.keyHistory.find((k) => k.fingerprint === user.signingKey.fingerprint);
      if (hist && !hist.revokedAt) hist.revokedAt = new Date();
    }
    await user.save();
    await audit(req, 'FUNCIONARIO_DESATIVADO', user._id);
    return res.json({ message: 'Funcionário desativado e chave de assinatura revogada' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
