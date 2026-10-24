const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const config = require('../config');
const Expense = require('../models/Expense');
const { CATEGORIES } = require('../models/Expense');
const Receipt = require('../models/Receipt');
const User = require('../models/User');
const { authenticate, authorize, csrfProtection } = require('../middleware/auth');
const { handleValidation, validId, stripTags } = require('../middleware/validate');
const { buildSignedDocument } = require('../services/document');
const cryptoSvc = require('../services/crypto');
const { sendMail } = require('../services/mailer');
const { audit } = require('../services/audit');

const router = express.Router();
router.use(authenticate, csrfProtection);

const APPROVERS = ['SUPERVISOR', 'GERENTE'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.rules.maxReceiptBytes, files: 1, fields: 10 },
});

// RN06: o tipo do recibo é conferido pelos "magic bytes", não pela extensão/MIME enviado
function detectMime(buf) {
  if (buf.length > 4 && buf.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return null;
}

const POPULATE = [
  { path: 'employee', select: 'name email department' },
  { path: 'validation.by', select: 'name' },
  { path: 'rejection.by', select: 'name' },
  { path: 'signature.signer', select: 'name email role' },
];

const ref = (u) => (u && u._id ? { id: u._id.toString(), name: u.name } : null);

function serializeExpense(e) {
  return {
    id: e._id.toString(),
    employee: e.employee ? { ...ref(e.employee), email: e.employee.email, department: e.employee.department } : null,
    description: e.description,
    category: e.category,
    amount: e.amount,
    expenseDate: e.expenseDate.toISOString(),
    receiptName: e.receiptName,
    receiptMime: e.receiptMime,
    receiptSha256: e.receiptSha256,
    status: e.status,
    validation: e.validation && e.validation.at ? { by: ref(e.validation.by), at: e.validation.at.toISOString(), notes: e.validation.notes } : null,
    rejection: e.rejection && e.rejection.at ? { by: ref(e.rejection.by), at: e.rejection.at.toISOString(), reason: e.rejection.reason } : null,
    signature:
      e.signature && e.signature.value
        ? {
            signer: e.signature.signer ? { ...ref(e.signature.signer), role: e.signature.signer.role } : null,
            algorithm: e.signature.algorithm,
            value: e.signature.value,
            publicKey: e.signature.publicKey,
            keyFingerprint: e.signature.keyFingerprint,
            document: e.signature.document,
            documentHash: e.signature.documentHash,
            signedAt: e.signature.signedAt.toISOString(),
            serverTimestamp: e.signature.serverTimestamp,
          }
        : null,
    createdAt: e.createdAt,
  };
}

async function loadExpense(req, res) {
  const expense = await Expense.findById(req.params.id).populate(POPULATE);
  if (!expense) {
    res.status(404).json({ error: 'Despesa não encontrada' });
    return null;
  }
  const isOwner = expense.employee && expense.employee._id.toString() === req.user.id;
  if (!isOwner && !APPROVERS.includes(req.user.role)) {
    res.status(403).json({ error: 'Acesso negado' });
    return null;
  }
  return expense;
}

async function approverEmails() {
  const users = await User.find({ role: { $in: APPROVERS }, active: true }).select('email');
  return users.map((u) => u.email);
}

const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ---------------- Submissão (qualquer colaborador) ----------------
router.post(
  '/',
  upload.single('receipt'),
  body('description').trim().isLength({ min: 5, max: 500 }).withMessage('Descrição deve ter de 5 a 500 caracteres').customSanitizer(stripTags),
  body('category').isIn(CATEGORIES).withMessage('Categoria inválida'),
  body('amount')
    .isFloat({ min: 0.01, max: config.rules.maxExpenseAmount })
    .withMessage(`Valor deve estar entre R$ 0,01 e ${brl(config.rules.maxExpenseAmount)}`)
    .toFloat(),
  body('expenseDate')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Data inválida')
    .custom((v) => {
      const d = new Date(`${v}T00:00:00.000Z`);
      const now = new Date();
      const min = new Date(now.getTime() - config.rules.maxExpenseAgeDays * 86400000);
      if (Number.isNaN(d.getTime()) || d > now) throw new Error('Data da despesa não pode ser futura');
      if (d < min) throw new Error(`Despesa com mais de ${config.rules.maxExpenseAgeDays} dias não pode ser reembolsada`);
      return true;
    }),
  handleValidation,
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Recibo obrigatório (PDF, PNG ou JPG)' });
      const mime = detectMime(req.file.buffer);
      if (!mime) return res.status(400).json({ error: 'Formato de recibo não permitido (aceitos: PDF, PNG, JPG)' });

      const sha256 = cryptoSvc.sha256Hex(req.file.buffer);
      // RN12: o mesmo recibo não pode ser reembolsado duas vezes
      if (await Expense.exists({ receiptSha256: sha256, status: { $ne: 'REJEITADO' } })) {
        return res.status(409).json({ error: 'Este recibo já foi enviado em outro relatório' });
      }

      const filename = stripTags(req.file.originalname).replace(/[^\w.\- ]/g, '_').slice(0, 100);
      const receipt = await Receipt.create({ filename, mimeType: mime, size: req.file.size, sha256, data: req.file.buffer });
      const amount = Math.round(req.body.amount * 100) / 100;
      const expense = await Expense.create({
        employee: req.user.id,
        description: req.body.description,
        category: req.body.category,
        amount,
        expenseDate: new Date(`${req.body.expenseDate}T00:00:00.000Z`),
        receipt: receipt._id,
        receiptName: filename,
        receiptMime: mime,
        receiptSha256: sha256,
      });
      await audit(req, 'DESPESA_SUBMETIDA', expense._id, { amount, sha256 });

      sendMail({
        to: await approverEmails(),
        subject: `Nova despesa pendente de validação - ${brl(amount)}`,
        lines: [`${req.user.name} enviou um relatório de despesa.`, `Descrição: ${expense.description}`, `Valor: ${brl(amount)}`],
        link: `${config.frontendUrl}/validateExpense/?id=${expense._id}`,
      });

      await expense.populate(POPULATE);
      return res.status(201).json({ expense: serializeExpense(expense) });
    } catch (err) {
      return next(err);
    }
  }
);

// ---------------- Listagens ----------------
router.get('/mine', async (req, res, next) => {
  try {
    const list = await Expense.find({ employee: req.user.id }).sort({ createdAt: -1 }).populate(POPULATE);
    res.json({ expenses: list.map(serializeExpense) });
  } catch (err) {
    next(err);
  }
});

router.get('/pending', authorize(...APPROVERS), async (req, res, next) => {
  try {
    const list = await Expense.find({ status: { $in: ['PENDENTE', 'VALIDADO'] } })
      .sort({ createdAt: 1 })
      .populate(POPULATE);
    res.json({ expenses: list.map(serializeExpense) });
  } catch (err) {
    next(err);
  }
});

router.get('/signed', authorize('GERENTE'), async (req, res, next) => {
  try {
    const list = await Expense.find({ status: 'ASSINADO' }).sort({ 'signature.signedAt': -1 }).populate(POPULATE);
    res.json({ expenses: list.map(serializeExpense) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', validId, async (req, res, next) => {
  try {
    const expense = await loadExpense(req, res);
    if (expense) res.json({ expense: serializeExpense(expense) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/receipt', validId, async (req, res, next) => {
  try {
    const expense = await loadExpense(req, res);
    if (!expense) return;
    const receipt = await Receipt.findById(expense.receipt);
    res.set({
      'Content-Type': receipt.mimeType,
      'Content-Disposition': `inline; filename="${receipt.filename}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    });
    res.send(receipt.data);
  } catch (err) {
    next(err);
  }
});

// ---------------- Validação (aprovar / rejeitar) ----------------
router.post(
  '/:id/validate',
  validId,
  authorize(...APPROVERS),
  body('decision').isIn(['APROVAR', 'REJEITAR']).withMessage('Decisão inválida'),
  body('notes').optional().trim().isLength({ max: 500 }).customSanitizer(stripTags),
  handleValidation,
  async (req, res, next) => {
    try {
      const expense = await loadExpense(req, res);
      if (!expense) return undefined;
      // RN10: segregação de funções - ninguém valida/assina a própria despesa
      if (expense.employee._id.toString() === req.user.id) {
        return res.status(403).json({ error: 'Você não pode validar sua própria despesa' });
      }
      if (expense.status !== 'PENDENTE') return res.status(409).json({ error: 'A despesa não está pendente de validação' });

      const approve = req.body.decision === 'APROVAR';
      if (!approve && (!req.body.notes || req.body.notes.length < 10)) {
        return res.status(400).json({ error: 'Informe o motivo da rejeição (mínimo 10 caracteres)' });
      }
      const now = new Date();
      const update = approve
        ? { status: 'VALIDADO', validation: { by: req.user.id, at: now, notes: req.body.notes } }
        : { status: 'REJEITADO', rejection: { by: req.user.id, at: now, reason: req.body.notes } };
      // Atualização condicional ao status atual: evita condição de corrida entre dois validadores
      const updated = await Expense.findOneAndUpdate({ _id: expense._id, status: 'PENDENTE' }, { $set: update }, { new: true }).populate(POPULATE);
      if (!updated) return res.status(409).json({ error: 'A despesa foi alterada por outro usuário' });

      await audit(req, approve ? 'DESPESA_VALIDADA' : 'DESPESA_REJEITADA', expense._id, { notes: req.body.notes });
      sendMail({
        to: approve ? [expense.employee.email, ...(await approverEmails())] : expense.employee.email,
        subject: approve ? 'Despesa validada - aguardando assinatura' : 'Despesa rejeitada',
        lines: [
          `Relatório: ${expense.description} (${brl(expense.amount)})`,
          approve ? `Validado por ${req.user.name}. Aguardando assinatura digital.` : `Rejeitado por ${req.user.name}. Motivo: ${req.body.notes}`,
        ],
        link: approve ? `${config.frontendUrl}/signExpense/?id=${expense._id}` : `${config.frontendUrl}/myExpenses/`,
      });
      return res.json({ expense: serializeExpense(updated) });
    } catch (err) {
      return next(err);
    }
  }
);

// ---------------- Assinatura digital ----------------
router.post(
  '/:id/sign',
  validId,
  authorize(...APPROVERS),
  body('signature').isString().isLength({ min: 80, max: 200 }).matches(/^[A-Za-z0-9+/]+={0,2}$/),
  body('keyFingerprint').isString().matches(/^[a-f0-9]{64}$/),
  handleValidation,
  async (req, res, next) => {
    try {
      const expense = await loadExpense(req, res);
      if (!expense) return undefined;
      if (expense.employee._id.toString() === req.user.id) {
        return res.status(403).json({ error: 'Você não pode assinar sua própria despesa' });
      }
      if (expense.status !== 'VALIDADO') return res.status(409).json({ error: 'A despesa precisa estar VALIDADA para ser assinada' });
      // RN09: alçada - valores altos exigem assinatura do GERENTE
      if (expense.amount > config.rules.managerOnlyAbove && req.user.role !== 'GERENTE') {
        return res.status(403).json({ error: `Despesas acima de ${brl(config.rules.managerOnlyAbove)} exigem assinatura do Gerente` });
      }
      const key = req.user.doc.signingKey;
      if (!key || !key.publicKey) return res.status(400).json({ error: 'Cadastre seu par de chaves antes de assinar' });
      if (key.fingerprint !== req.body.keyFingerprint) {
        return res.status(400).json({ error: 'A chave usada não é a sua chave ativa' });
      }

      // O servidor reconstrói o documento e verifica a assinatura com Node.js Crypto
      const document = buildSignedDocument(serializeExpense(expense), req.user.id);
      if (!cryptoSvc.verifySignature(key.publicKey, req.body.signature, document)) {
        await audit(req, 'ASSINATURA_INVALIDA', expense._id);
        return res.status(400).json({ error: 'Assinatura inválida: o documento assinado não confere' });
      }

      const documentHash = cryptoSvc.sha256Hex(document);
      const serverTimestamp = await cryptoSvc.issueTimestamp({ expenseId: expense._id.toString(), documentHash, signature: req.body.signature });
      const signature = {
        signer: req.user.id,
        algorithm: cryptoSvc.SIGNATURE_ALGORITHM,
        value: req.body.signature,
        publicKey: key.publicKey,
        keyFingerprint: key.fingerprint,
        document,
        documentHash,
        signedAt: new Date(JSON.parse(serverTimestamp.payload).carimboEm),
        serverTimestamp,
      };
      const updated = await Expense.findOneAndUpdate(
        { _id: expense._id, status: 'VALIDADO' },
        { $set: { status: 'ASSINADO', signature } },
        { new: true }
      ).populate(POPULATE);
      if (!updated) return res.status(409).json({ error: 'A despesa foi alterada por outro usuário' });

      await audit(req, 'DESPESA_ASSINADA', expense._id, { documentHash, fingerprint: key.fingerprint });
      const managers = await User.find({ role: 'GERENTE', active: true }).select('email');
      sendMail({
        to: [expense.employee.email, ...managers.map((m) => m.email)],
        subject: 'Relatório de despesa assinado digitalmente',
        lines: [
          `Relatório: ${expense.description} (${brl(expense.amount)})`,
          `Assinado por ${req.user.name} em ${signature.signedAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
          `Hash SHA-256 do documento: ${documentHash}`,
        ],
        link: `${config.frontendUrl}/verifySignature/?id=${expense._id}`,
      });
      return res.json({ expense: serializeExpense(updated) });
    } catch (err) {
      return next(err);
    }
  }
);

// ---------------- Verificação no servidor (complementa a verificação no navegador) ----------------
router.get('/:id/verify', validId, authorize('GERENTE'), async (req, res, next) => {
  try {
    const expense = await loadExpense(req, res);
    if (!expense) return undefined;
    if (expense.status !== 'ASSINADO') return res.status(409).json({ error: 'Documento ainda não assinado' });

    const sig = expense.signature;
    const receipt = await Receipt.findById(expense.receipt);
    const signer = await User.findById(sig.signer);
    const rebuilt = buildSignedDocument(serializeExpense(expense), sig.signer._id.toString());
    const histKey = signer && signer.keyHistory.find((k) => k.fingerprint === sig.keyFingerprint);
    const { publicKey: serverPub } = await cryptoSvc.getServerKeys();
    const tsPayload = JSON.parse(sig.serverTimestamp.payload);
    const tsValid = cryptoSvc.verifySignature(serverPub, sig.serverTimestamp.signature, sig.serverTimestamp.payload);

    const checks = [
      { id: 'receipt', label: 'Integridade do recibo (SHA-256 do arquivo)', ok: cryptoSvc.sha256Hex(receipt.data) === expense.receiptSha256 },
      { id: 'document', label: 'Integridade dos dados (documento reconstruído = documento assinado)', ok: rebuilt === sig.document && cryptoSvc.sha256Hex(rebuilt) === sig.documentHash },
      { id: 'signature', label: 'Assinatura ECDSA válida (Node.js Crypto)', ok: cryptoSvc.verifySignature(sig.publicKey, sig.value, rebuilt) },
      { id: 'fingerprint', label: 'Impressão digital da chave confere', ok: cryptoSvc.fingerprint(sig.publicKey) === sig.keyFingerprint },
      { id: 'ownership', label: 'Chave pertence ao signatário (autenticidade)', ok: Boolean(histKey && histKey.publicKey === sig.publicKey) },
      { id: 'revocation', label: 'Chave não estava revogada no momento da assinatura', ok: Boolean(histKey && (!histKey.revokedAt || histKey.revokedAt > sig.signedAt)) },
      { id: 'timestamp', label: 'Carimbo de tempo do servidor válido', ok: tsValid && tsPayload.documentoSha256 === sig.documentHash },
    ];
    const valid = checks.every((c) => c.ok);
    await audit(req, 'ASSINATURA_VERIFICADA', expense._id, { valid });
    return res.json({ valid, checks, serverPublicKey: serverPub });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
