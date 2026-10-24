const { validationResult } = require('express-validator');
const { isValidObjectId } = require('mongoose');

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Dados inválidos', details: errors.array().map((e) => e.msg) });
  }
  return next();
}

function validId(req, res, next) {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Identificador inválido' });
  return next();
}

// Remove sinais de tag HTML de textos livres (defesa em profundidade contra XSS armazenado;
// o React ainda escapa toda saída na interface).
const stripTags = (value) => String(value).replace(/[<>]/g, '');

module.exports = { handleValidation, validId, stripTags };
