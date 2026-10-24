// Geração de chaves, assinatura e verificação com a Web Cryptography API (window.crypto.subtle).
// Algoritmo: ECDSA com curva P-256 e hash SHA-256.

const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_PARAMS = { name: 'ECDSA', hash: 'SHA-256' };
const PBKDF2_ITERATIONS = 310000; // recomendação OWASP para PBKDF2-HMAC-SHA256

const subtle = () => {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API indisponível (use HTTPS ou localhost)');
  }
  return window.crypto.subtle;
};

export const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
export const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const utf8 = (text) => new TextEncoder().encode(text);

export async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? utf8(data) : data;
  return toHex(await subtle().digest('SHA-256', bytes));
}

export const fingerprint = (spkiB64) => sha256Hex(fromB64(spkiB64));

// Deriva uma chave AES-256-GCM a partir da frase secreta (PBKDF2)
async function deriveWrappingKey(passphrase, salt, iterations) {
  const base = await subtle().importKey('raw', utf8(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Gera o par de chaves e cifra a chave privada com a frase secreta do usuário. */
export async function generateSigningKey(passphrase) {
  const pair = await subtle().generateKey(ECDSA, true, ['sign', 'verify']);
  const spki = await subtle().exportKey('spki', pair.publicKey);
  const pkcs8 = await subtle().exportKey('pkcs8', pair.privateKey);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aes = await deriveWrappingKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ciphertext = await subtle().encrypt({ name: 'AES-GCM', iv }, aes, pkcs8);

  return {
    publicKey: toB64(spki),
    encryptedPrivateKey: {
      ciphertext: toB64(ciphertext),
      iv: toB64(iv),
      salt: toB64(salt),
      iterations: PBKDF2_ITERATIONS,
    },
  };
}

/** Decifra a chave privada (somente em memória, como chave NÃO exportável). */
export async function unlockPrivateKey(enc, passphrase) {
  const aes = await deriveWrappingKey(passphrase, fromB64(enc.salt), enc.iterations);
  let pkcs8;
  try {
    pkcs8 = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(enc.iv) }, aes, fromB64(enc.ciphertext));
  } catch {
    throw new Error('Frase secreta incorreta');
  }
  return subtle().importKey('pkcs8', pkcs8, ECDSA, false, ['sign']);
}

export async function signText(privateKey, text) {
  return toB64(await subtle().sign(SIGN_PARAMS, privateKey, utf8(text)));
}

export async function verifyText(spkiB64, signatureB64, text) {
  try {
    const key = await subtle().importKey('spki', fromB64(spkiB64), ECDSA, false, ['verify']);
    return await subtle().verify(SIGN_PARAMS, key, fromB64(signatureB64), utf8(text));
  } catch {
    return false;
  }
}
