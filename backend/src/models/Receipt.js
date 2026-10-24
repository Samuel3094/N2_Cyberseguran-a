const { Schema, model } = require('mongoose');

// Recibo guardado separado da despesa para não carregar o binário nas listagens.
const receiptSchema = new Schema(
  {
    filename: { type: String, required: true },
    mimeType: { type: String, required: true, enum: ['application/pdf', 'image/png', 'image/jpeg'] },
    size: { type: Number, required: true },
    sha256: { type: String, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

module.exports = model('Receipt', receiptSchema);
