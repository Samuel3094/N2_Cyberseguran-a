const { Schema, model } = require('mongoose');

const STATUS = ['PENDENTE', 'VALIDADO', 'REJEITADO', 'ASSINADO'];
const CATEGORIES = ['TRANSPORTE', 'HOSPEDAGEM', 'ALIMENTACAO', 'MATERIAL', 'TREINAMENTO', 'OUTROS'];

const expenseSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    category: { type: String, enum: CATEGORIES, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    expenseDate: { type: Date, required: true },

    receipt: { type: Schema.Types.ObjectId, ref: 'Receipt', required: true },
    receiptName: String,
    receiptMime: String,
    receiptSha256: { type: String, required: true },

    status: { type: String, enum: STATUS, default: 'PENDENTE', index: true },

    validation: {
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      at: Date,
      notes: String,
    },
    rejection: {
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      at: Date,
      reason: String,
    },
    signature: {
      signer: { type: Schema.Types.ObjectId, ref: 'User' },
      algorithm: String,
      value: String, // assinatura ECDSA (IEEE P1363, base64)
      publicKey: String, // SPKI base64 utilizada
      keyFingerprint: String,
      document: String, // documento canônico assinado (JSON)
      documentHash: String, // SHA-256 hex do documento
      signedAt: Date,
      serverTimestamp: {
        payload: String, // JSON assinado pelo servidor
        signature: String,
      },
    },
  },
  { timestamps: true }
);

// RN11: documento assinado é imutável (integridade)
expenseSchema.pre('save', async function preventChangesAfterSigning(next) {
  if (this.isNew) return next();
  const stored = await this.constructor.findById(this._id).select('status').lean();
  if (stored && stored.status === 'ASSINADO') {
    return next(new Error('Documento assinado não pode ser alterado'));
  }
  return next();
});

for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
  expenseSchema.pre(op, function blockSignedMutation() {
    this.and([{ status: { $ne: 'ASSINADO' } }]);
  });
}

module.exports = model('Expense', expenseSchema);
module.exports.STATUS = STATUS;
module.exports.CATEGORIES = CATEGORIES;
