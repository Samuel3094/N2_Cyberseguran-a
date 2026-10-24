const multer = require('multer');
const config = require('../config');

function notFound(req, res) {
  res.status(404).json({ error: 'Rota não encontrada' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Recibo excede 5 MB' : 'Erro no upload do recibo';
    return res.status(400).json({ error: msg });
  }
  if (err.code === 11000) return res.status(409).json({ error: 'Registro duplicado (e-mail ou CPF já cadastrado)' });
  if (err.name === 'ValidationError') return res.status(400).json({ error: 'Dados inválidos' });

  const status = err.status || 500;
  if (status >= 500) console.error('[erro]', err);
  // Em produção não vaza detalhes internos (stack, mensagens do banco)
  const message = status < 500 || config.env !== 'production' ? err.message : 'Erro interno';
  return res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
