require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  if (process.env.NODE_ENV === 'production' && (value.startsWith('troque') || value.length < 32)) {
    throw new Error(`${name} fraco: use um valor aleatório com pelo menos 32 caracteres em produção`);
  }
  return value;
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  mongoUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  csrfSecret: required('CSRF_SECRET'),
  serverKeySecret: required('SERVER_KEY_SECRET'),
  admin: {
    name: process.env.ADMIN_NAME || 'Gerente Administrador',
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'Assinatura Digital <no-reply@empresa.com>',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // ---------- Regras de negócio ----------
  rules: {
    maxExpenseAmount: 50000, // RN05: teto por relatório (R$)
    managerOnlyAbove: 5000, // RN09: acima deste valor apenas GERENTE pode assinar (alçada)
    maxReceiptBytes: 5 * 1024 * 1024, // RN06: recibo até 5 MB
    maxExpenseAgeDays: 90, // RN05: despesa com no máximo 90 dias
    maxFailedLogins: 5, // RN02: bloqueio após 5 tentativas
    lockMinutes: 15,
  },
};
