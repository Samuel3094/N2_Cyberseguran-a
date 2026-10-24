const { Schema, model } = require('mongoose');

// Par de chaves do servidor usado para o carimbo de tempo das assinaturas.
const serverKeySchema = new Schema({
  publicKey: { type: String, required: true }, // SPKI base64
  encryptedPrivateKey: {
    salt: String,
    iv: String,
    tag: String,
    data: String,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = model('ServerKey', serverKeySchema);
