// Operações criptográficas do servidor com o módulo nativo Node.js Crypto.
const crypto = require('crypto');
const config = require('../config');
const ServerKey = require('../models/ServerKey');
const { canonicalize } = require('./document');

const SIGNATURE_ALGORITHM = 'ECDSA_P256_SHA256';

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function fingerprint(spkiBase64) {
  return sha256Hex(Buffer.from(spkiBase64, 'base64'));
}

// Aceita somente chaves públicas EC P-256 válidas
function assertValidPublicKey(spkiBase64) {
  let key;
  try {
    key = crypto.createPublicKey({ key: Buffer.from(spkiBase64, 'base64'), format: 'der', type: 'spki' });
  } catch {
    throw Object.assign(new Error('Chave pública inválida'), { status: 400 });
  }
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails.namedCurve !== 'prime256v1') {
    throw Object.assign(new Error('A chave deve ser ECDSA P-256'), { status: 400 });
  }
}

// Verifica assinatura ECDSA gerada pela Web Crypto API (formato IEEE P1363 = r||s)
function verifySignature(spkiBase64, signatureBase64, data) {
  try {
    return crypto.verify(
      'sha256',
      Buffer.from(data, 'utf8'),
      { key: Buffer.from(spkiBase64, 'base64'), format: 'der', type: 'spki', dsaEncoding: 'ieee-p1363' },
      Buffer.from(signatureBase64, 'base64')
    );
  } catch {
    return false;
  }
}

// ---------- Chave do servidor (carimbo de tempo) ----------
let cached = null;

function deriveKey(salt) {
  return crypto.scryptSync(config.serverKeySecret, salt, 32);
}

async function getServerKeys() {
  if (cached) return cached;
  let doc = await ServerKey.findOne().sort({ createdAt: -1 });

  if (!doc) {
    // Geração de chaves com Node.js Crypto
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const pkcs8 = privateKey.export({ format: 'der', type: 'pkcs8' });
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(salt), iv);
    const data = Buffer.concat([cipher.update(pkcs8), cipher.final()]);
    doc = await ServerKey.create({
      publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
      encryptedPrivateKey: {
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: data.toString('base64'),
      },
    });
    console.log('[crypto] novo par de chaves do servidor gerado');
  }

  const enc = doc.encryptedPrivateKey;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(Buffer.from(enc.salt, 'base64')),
    Buffer.from(enc.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));
  const pkcs8 = Buffer.concat([decipher.update(Buffer.from(enc.data, 'base64')), decipher.final()]);

  cached = {
    publicKey: doc.publicKey,
    privateKey: crypto.createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' }),
  };
  return cached;
}

// Carimbo de tempo: o servidor atesta QUANDO a assinatura foi recebida
async function issueTimestamp({ expenseId, documentHash, signature }) {
  const { privateKey } = await getServerKeys();
  const payload = canonicalize({
    emissor: 'servidor-assinatura-digital',
    despesaId: expenseId,
    documentoSha256: documentHash,
    assinaturaSha256: sha256Hex(Buffer.from(signature, 'base64')),
    carimboEm: new Date().toISOString(),
  });
  const sig = crypto.sign('sha256', Buffer.from(payload, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return { payload, signature: sig.toString('base64') };
}

module.exports = {
  SIGNATURE_ALGORITHM,
  sha256Hex,
  fingerprint,
  assertValidPublicKey,
  verifySignature,
  getServerKeys,
  issueTimestamp,
};
