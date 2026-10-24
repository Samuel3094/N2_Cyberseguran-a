const { Schema, model } = require('mongoose');

const ROLES = ['FUNCIONARIO', 'SUPERVISOR', 'GERENTE'];

const keySchema = new Schema(
  {
    publicKey: { type: String, required: true }, // SPKI em base64 (ECDSA P-256)
    fingerprint: { type: String, required: true }, // SHA-256 hex da SPKI
    createdAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    cpf: { type: String, required: true, unique: true, match: /^\d{11}$/ },
    department: { type: String, trim: true, maxlength: 80, default: '' },
    position: { type: String, trim: true, maxlength: 80, default: '' },
    role: { type: String, enum: ROLES, default: 'FUNCIONARIO' },
    active: { type: Boolean, default: true },

    // Senha: apenas o hash bcrypt é armazenado, nunca retornado por padrão
    passwordHash: { type: String, required: true, select: false },
    failedLogins: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },

    // Chave de assinatura: a chave privada é cifrada NO NAVEGADOR (PBKDF2 + AES-GCM)
    // com uma frase secreta que o servidor nunca recebe. O servidor guarda apenas o "envelope".
    signingKey: {
      publicKey: String,
      fingerprint: String,
      encryptedPrivateKey: {
        ciphertext: String,
        iv: String,
        salt: String,
        iterations: Number,
      },
      createdAt: Date,
    },
    keyHistory: { type: [keySchema], default: [] },
  },
  { timestamps: true }
);

// LGPD: CPF mascarado em respostas (minimização de dados)
userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    cpf: this.cpf ? `***.${this.cpf.slice(3, 6)}.${this.cpf.slice(6, 9)}-**` : undefined,
    department: this.department,
    position: this.position,
    role: this.role,
    active: this.active,
    hasSigningKey: Boolean(this.signingKey && this.signingKey.publicKey),
    keyFingerprint: this.signingKey ? this.signingKey.fingerprint : undefined,
    createdAt: this.createdAt,
  };
};

module.exports = model('User', userSchema);
module.exports.ROLES = ROLES;
