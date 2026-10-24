// Teste ponta a ponta: sobe a API com MongoDB em memória e percorre todo o fluxo + ataques comuns.
// Executar: npm test
const path = require('path');
const { pathToFileURL } = require('url');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ROOT = path.join(__dirname, '..', '..');
const subtle = globalThis.crypto.subtle;

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${cond ? '' : extra}`); };
const b64 = (buf) => Buffer.from(buf).toString('base64');

(async () => {
  const mongo = await MongoMemoryServer.create();
  Object.assign(process.env, {
    MONGODB_URI: mongo.getUri('assinaturas'), JWT_SECRET: 'x'.repeat(40), CSRF_SECRET: 'y'.repeat(40), SERVER_KEY_SECRET: 'z'.repeat(40),
    ADMIN_EMAIL: 'gerente@empresa.com', ADMIN_PASSWORD: 'Gerente@2026!', CORS_ORIGINS: 'http://localhost:3000',
  });
  const { connect, mongoose } = require(path.join(ROOT, 'backend/src/db'));
  await connect();
  await require(path.join(ROOT, 'backend/src/seed'))();
  const app = require(path.join(ROOT, 'backend/src/app'));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const { buildSignedDocument } = await import(pathToFileURL(path.join(ROOT, 'frontend/lib/document.js')).href);

  const call = async (method, p, body, s, extraHeaders = {}) => {
    const headers = { ...extraHeaders };
    if (s) { headers.Authorization = `Bearer ${s.token}`; headers['X-CSRF-Token'] = s.csrfToken; }
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const r = await fetch(base + p, { method, headers, body: body instanceof FormData ? body : body && JSON.stringify(body) });
    const ct = r.headers.get('content-type') || '';
    return { status: r.status, data: ct.includes('json') ? await r.json() : await r.arrayBuffer(), headers: r.headers };
  };
  const login = async (email, password) => (await call('POST', '/auth/login', { email, password })).data;

  // ---- autenticação ----
  const g = await login('gerente@empresa.com', 'Gerente@2026!');
  check('login gerente', g.token && g.user.role === 'GERENTE');
  const health = await call('GET', '/health');
  check('helmet: CSP/HSTS presentes', health.headers.get('content-security-policy') && health.headers.get('strict-transport-security'));
  check('injeção NoSQL no login bloqueada', (await call('POST', '/auth/login', { email: { $ne: null }, password: 'x' })).status === 400);
  check('senha errada -> 401', (await call('POST', '/auth/login', { email: 'gerente@empresa.com', password: 'errada' })).status === 401);

  // ---- CRUD funcionários ----
  const sup = await call('POST', '/employees', { name: 'Sara Supervisora', email: 'sup@empresa.com', cpf: '111.444.777-35', role: 'SUPERVISOR', password: 'Super@2026!', department: 'Financeiro' }, g);
  check('criar supervisor', sup.status === 201, JSON.stringify(sup.data));
  const fun = await call('POST', '/employees', { name: 'Fábio Funcionário', email: 'func@empresa.com', cpf: '39053344705', role: 'FUNCIONARIO', password: 'Func@2026!x' }, g);
  check('criar funcionário', fun.status === 201, JSON.stringify(fun.data));
  check('CPF inválido rejeitado', (await call('POST', '/employees', { name: 'X Y Z', email: 'x@e.com', cpf: '12345678900', role: 'FUNCIONARIO', password: 'Func@2026!x' }, g)).status === 400);
  check('senha fraca rejeitada', (await call('POST', '/employees', { name: 'X Y Z', email: 'x@e.com', cpf: '15350946056', role: 'FUNCIONARIO', password: '123' }, g)).status === 400);
  check('CPF mascarado (LGPD)', sup.data.employee.cpf.startsWith('***'));
  const tokenNoCsrf = { token: g.token, csrfToken: 'invalido'.padEnd(64, '0') };
  check('CSRF inválido -> 403', (await call('POST', '/employees', { name: 'a' }, tokenNoCsrf)).status === 403);

  const f = await login('func@empresa.com', 'Func@2026!x');
  const s = await login('sup@empresa.com', 'Super@2026!');
  check('funcionário não acessa CRUD', (await call('GET', '/employees', null, f)).status === 403);

  // ---- submissão ----
  const png = (seed) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(`recibo-${seed}-${Math.random()}`)]);
  const today = new Date().toISOString().slice(0, 10);
  const submit = (amount, file, sess = f) => {
    const fd = new FormData();
    fd.append('description', 'Táxi aeroporto <script>alert(1)</script>');
    fd.append('category', 'TRANSPORTE'); fd.append('amount', String(amount)); fd.append('expenseDate', today);
    fd.append('receipt', new Blob([file]), 'recibo.png');
    return call('POST', '/expenses', fd, sess);
  };
  const recibo = png(1);
  const e1 = await submit(150.5, recibo);
  check('submeter despesa', e1.status === 201, JSON.stringify(e1.data));
  check('XSS: tags removidas', !e1.data.expense.description.includes('<'));
  check('recibo duplicado rejeitado', (await submit(10, recibo)).status === 409);
  check('arquivo não permitido rejeitado', (await submit(10, Buffer.from('MZ executavel'))).status === 400);
  const fdFuture = new FormData(); fdFuture.append('description', 'Despesa futura'); fdFuture.append('category', 'OUTROS'); fdFuture.append('amount', '10'); fdFuture.append('expenseDate', '2099-01-01'); fdFuture.append('receipt', new Blob([png(9)]), 'r.png');
  check('data futura rejeitada', (await call('POST', '/expenses', fdFuture, f)).status === 400);
  const id = e1.data.expense.id;

  // ---- validação ----
  check('funcionário não lista pendentes', (await call('GET', '/expenses/pending', null, f)).status === 403);
  check('rejeição sem motivo bloqueada', (await call('POST', `/expenses/${id}/validate`, { decision: 'REJEITAR' }, s)).status === 400);
  const v = await call('POST', `/expenses/${id}/validate`, { decision: 'APROVAR', notes: 'Conferido' }, s);
  check('validar despesa', v.status === 200 && v.data.expense.status === 'VALIDADO', JSON.stringify(v.data));

  // ---- chave (simula o navegador) ----
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const spki = b64(await subtle.exportKey('spki', pair.publicKey));
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await subtle.importKey('raw', new TextEncoder().encode('FraseSecreta123'), 'PBKDF2', false, ['deriveKey']);
  const aes = await subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, aes, await subtle.exportKey('pkcs8', pair.privateKey));
  const reg = await call('POST', '/keys', { publicKey: spki, encryptedPrivateKey: { ciphertext: b64(ct), iv: b64(iv), salt: b64(salt), iterations: 310000 } }, s);
  check('registrar chave', reg.status === 201, JSON.stringify(reg.data));
  check('funcionário não registra chave', (await call('POST', '/keys', { publicKey: spki }, f)).status === 403);

  // ---- assinatura ----
  const exp = (await call('GET', `/expenses/${id}`, null, s)).data.expense;
  const doc = buildSignedDocument(exp, s.user.id);
  const sig = b64(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(doc)));
  const badSig = b64(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(doc + 'x')));
  check('assinatura de outro conteúdo rejeitada', (await call('POST', `/expenses/${id}/sign`, { signature: badSig, keyFingerprint: reg.data.fingerprint }, s)).status === 400);
  const signed = await call('POST', `/expenses/${id}/sign`, { signature: sig, keyFingerprint: reg.data.fingerprint }, s);
  check('assinar despesa', signed.status === 200 && signed.data.expense.status === 'ASSINADO', JSON.stringify(signed.data));
  check('não assina duas vezes', (await call('POST', `/expenses/${id}/sign`, { signature: sig, keyFingerprint: reg.data.fingerprint }, s)).status === 409);

  // ---- verificação ----
  const ver = await call('GET', `/expenses/${id}/verify`, null, g);
  check('verificação servidor: válida', ver.data.valid === true, JSON.stringify(ver.data.checks));
  check('supervisor não acessa assinados', (await call('GET', '/expenses/signed', null, s)).status === 403);
  check('gerente lista assinados', (await call('GET', '/expenses/signed', null, g)).data.expenses.length === 1);
  const se = signed.data.expense;
  const { publicKey: serverPub } = (await call('GET', '/keys/server')).data;
  const imp = (spkiB64) => subtle.importKey('spki', Buffer.from(spkiB64, 'base64'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const okClient = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await imp(se.signature.publicKey), Buffer.from(se.signature.value, 'base64'), new TextEncoder().encode(buildSignedDocument(se, se.signature.signer.id)));
  check('verificação cliente (Web Crypto): válida', okClient);
  const okTs = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await imp(serverPub), Buffer.from(se.signature.serverTimestamp.signature, 'base64'), new TextEncoder().encode(se.signature.serverTimestamp.payload));
  check('carimbo de tempo válido (Web Crypto)', okTs);

  // ---- imutabilidade e adulteração ----
  const Expense = require(path.join(ROOT, 'backend/src/models/Expense'));
  const r = await Expense.updateOne({ _id: id }, { $set: { amount: 9999 } });
  check('documento assinado imutável via Mongoose', r.modifiedCount === 0);
  await mongoose.connection.collection('expenses').updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { amount: 150.51 } });
  const ver2 = await call('GET', `/expenses/${id}/verify`, null, g);
  check('adulteração direta no banco detectada', ver2.data.valid === false && ver2.data.checks.find((c) => c.id === 'document').ok === false);

  // ---- alçada e segregação ----
  const e2 = await submit(6000, png(2));
  await call('POST', `/expenses/${e2.data.expense.id}/validate`, { decision: 'APROVAR' }, s);
  const exp2 = (await call('GET', `/expenses/${e2.data.expense.id}`, null, s)).data.expense;
  const sig2 = b64(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(buildSignedDocument(exp2, s.user.id))));
  const al = await call('POST', `/expenses/${exp2.id}/sign`, { signature: sig2, keyFingerprint: reg.data.fingerprint }, s);
  check('alçada: > R$ 5.000 exige gerente', al.status === 403, JSON.stringify(al.data));
  const e3 = await submit(50, png(3), s);
  check('segregação: não valida a própria despesa', (await call('POST', `/expenses/${e3.data.expense.id}/validate`, { decision: 'APROVAR' }, s)).status === 403);
  check('funcionário não vê despesa alheia', (await call('GET', `/expenses/${e3.data.expense.id}`, null, f)).status === 403);

  // ---- bloqueio de conta ----
  for (let i = 0; i < 5; i++) await call('POST', '/auth/login', { email: 'func@empresa.com', password: 'errada' });
  check('conta bloqueada após 5 falhas', (await call('POST', '/auth/login', { email: 'func@empresa.com', password: 'Func@2026!x' })).status === 423);

  console.log(`\n${pass} passaram, ${fail} falharam`);
  server.close(); await mongoose.disconnect(); await mongo.stop();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
