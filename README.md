# Assinatura Digital de Relatórios de Despesas

Trabalho N2 – Segurança da Informação (Prof. Claudinei Dias). Sistema para **submeter, validar, assinar digitalmente e verificar** relatórios de despesas, garantindo **autenticidade, integridade e não repúdio**.

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (exportação estática) + Material-UI + Tailwind CSS |
| Backend | Node.js + Express + JWT + Helmet |
| Banco | MongoDB (Atlas em nuvem ou contêiner) |
| Criptografia | **Web Crypto API** (chaves, assinatura e verificação no navegador) + **Node.js Crypto** (verificação no servidor, carimbo de tempo, hashes) |
| E-mail | Nodemailer |
| Infra | Docker Compose com políticas de segurança · GitHub Pages (HTTPS/TLS) |

---

## 1. Perfis e fluxo

| Perfil | Pode |
|---|---|
| **FUNCIONARIO** | Enviar despesas com recibo e acompanhar as suas |
| **SUPERVISOR** | + validar (aprovar/rejeitar) e assinar despesas de outros (até R$ 5.000) |
| **GERENTE** | + CRUD de funcionários, assinar qualquer valor, listar assinados e **verificar assinaturas** |

```
Funcionário envia ──► PENDENTE ──(Supervisor/Gerente valida)──► VALIDADO ──(assina com chave privada)──► ASSINADO ──► Gerente verifica
                          └──(rejeita com motivo)──► REJEITADO
```
Cada transição envia e-mail (Nodemailer) aos envolvidos.

## 2. Regras de negócio

| Código | Regra |
|---|---|
| RN01 | Acesso somente autenticado; permissões por perfil checadas **no backend** em todas as rotas |
| RN02 | Senha forte (8+ com maiúscula, minúscula, número e símbolo), hash **bcrypt** (custo 12); conta bloqueada 15 min após 5 falhas; limite de 10 tentativas/15 min por IP |
| RN03 | CPF validado pelos dígitos verificadores, único, e **mascarado nas respostas (LGPD – minimização)** |
| RN04 | Funcionários não são apagados (exclusão lógica) para que assinaturas antigas continuem verificáveis; o gerente não pode desativar/rebaixar a si mesmo |
| RN05 | Valor entre R$ 0,01 e R$ 50.000; data não futura e com no máximo 90 dias |
| RN06 | Recibo obrigatório: PDF/PNG/JPG até 5 MB, tipo conferido pelos *magic bytes*; SHA-256 registrado no envio |
| RN07 | Apenas Supervisor/Gerente possuem chave de assinatura |
| RN08 | Gerar nova chave **revoga** a anterior; o histórico de chaves é mantido |
| RN09 | **Alçada**: despesas acima de R$ 5.000 só podem ser assinadas pelo Gerente |
| RN10 | **Segregação de funções**: ninguém valida nem assina a própria despesa |
| RN11 | Documento assinado é **imutável** (bloqueado no modelo); qualquer alteração direta no banco é detectada na verificação |
| RN12 | O mesmo recibo (mesmo hash) não pode ser reembolsado duas vezes |
| RN13 | Rejeição exige motivo (mín. 10 caracteres); assinatura exige aceite expresso do signatário |
| RN14 | Toda ação relevante gera registro de **auditoria** (usuário, IP, data, alvo) |

### Conformidade com a legislação brasileira
- **MP 2.200-2/2001** – validade jurídica de documentos eletrônicos; assinaturas fora da ICP-Brasil são válidas quando aceitas pelas partes (art. 10, §2º), que é o caso de um sistema interno.
- **Lei 14.063/2020** – o sistema implementa uma **assinatura eletrônica avançada**: associada unicamente ao signatário (chave privada só ele decifra), sob seu controle exclusivo (frase secreta nunca sai do navegador) e vinculada ao documento de forma que qualquer alteração seja detectável (hash + ECDSA).
- **LGPD (Lei 13.709/2018)** – minimização (CPF mascarado), finalidade, controle de acesso, trilha de auditoria e segurança dos dados.

## 3. Como a assinatura funciona

1. **Geração de chaves** (`/keys`): o navegador gera um par **ECDSA P-256** com a Web Crypto API. A chave privada é cifrada com **AES-256-GCM**, usando uma chave derivada da frase secreta por **PBKDF2-SHA256 (310.000 iterações)**. O servidor recebe só a chave pública e o "envelope" cifrado.
2. **Documento canônico**: os dados da despesa (id, funcionário, valor, data, categoria, **SHA-256 do recibo**, validador e signatário) viram um JSON com chaves ordenadas ([frontend/lib/document.js](frontend/lib/document.js) = [backend/src/services/document.js](backend/src/services/document.js)).
3. **Assinatura** (`/signExpense`): o signatário confere o documento, aceita os termos, digita a frase secreta; a chave é decifrada **só em memória** e assina o documento.
4. **Servidor**: reconstrói o documento por conta própria, verifica a assinatura com `crypto.verify` (Node.js Crypto) e emite um **carimbo de tempo** assinado com a chave ECDSA do servidor (gerada com `crypto.generateKeyPairSync` e guardada cifrada com AES-256-GCM).
5. **Verificação** (`/verifySignature`): o gerente vê duas verificações independentes, no navegador (Web Crypto) e no servidor (Node Crypto): integridade do recibo, integridade dos dados, validade da assinatura, impressão digital da chave, posse da chave pelo signatário, revogação e carimbo de tempo. Há um botão para **simular adulteração** e ver a verificação falhar.

## 4. Medidas de segurança

| Ameaça | Mitigação |
|---|---|
| Injeção SQL/NoSQL | `express-mongo-sanitize`, `strictQuery`, validação de tipos com `express-validator`, ObjectId validado |
| XSS | React escapa toda saída; remoção de `<>` nos textos; CSP via Helmet (API) e nginx (frontend) |
| CSRF | JWT enviado no cabeçalho `Authorization` (nunca em cookie) **+ token anti-CSRF** (`X-CSRF-Token` = HMAC do id da sessão) exigido em toda requisição que altera dados; CORS restrito |
| Cabeçalhos HTTP | **Helmet**: CSP, HSTS, X-Frame-Options, noSniff, Referrer-Policy, CORP |
| Força bruta | Rate limit global e de login, bloqueio de conta, bcrypt |
| Enumeração de usuários | Mensagem genérica e tempo constante (hash fictício) |
| JWT | Algoritmo fixo HS256, `iss`/`aud`/`exp`/`jti`, expiração de 1 h, usuário reconsultado a cada requisição |
| Upload malicioso | Limite de tamanho, *magic bytes*, armazenado no banco (nunca executado), `nosniff` |
| Poluição de parâmetros / payloads grandes | `hpp`, limite de 50 kb no JSON |
| Condição de corrida | Transições de status com atualização condicional (`findOneAndUpdate` com status esperado) |
| Vazamento de erros | Mensagens internas ocultadas em produção |
| Dependências | `npm audit` sem vulnerabilidades; auditoria no pipeline de deploy |

**Docker** ([docker-compose.yml](docker-compose.yml)): usuários não-root, `no-new-privileges`, `cap_drop: ALL`, sistema de arquivos `read_only`, limites de memória/CPU/PIDs, banco em **rede interna** sem porta exposta, portas publicadas só em `127.0.0.1`, imagens Alpine mínimas, healthchecks e rotação de logs.

## 5. Executando

### Opção A – Docker
```bash
cp .env.example .env        # troque os segredos!
docker compose up --build
```
Frontend: http://localhost:8080 · API: http://localhost:4000

### Opção B – Local (Node 20+)
```bash
# Backend (precisa de um MongoDB: Atlas ou local)
cd backend
cp .env.example .env        # ajuste MONGODB_URI e os segredos
npm install
npm start

# Frontend (outro terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```
Gere segredos com: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

**Login inicial:** `gerente@empresa.com` / `Gerente@2026!` (definido em `ADMIN_EMAIL`/`ADMIN_PASSWORD`).

### Roteiro de demonstração
1. Entre como gerente → **Funcionários** → crie um Supervisor e um Funcionário.
2. Entre como Funcionário → **Nova despesa** → envie com um recibo.
3. Entre como Supervisor → **Minha chave** → gere o par de chaves → **Pendentes** → Validar → Assinar.
4. Entre como Gerente → **Assinados** → **Verificar assinatura** (marque "simular adulteração" para ver a falha).

### Testes automatizados
```bash
cd backend && npm test      # 35 verificações: fluxo completo + ataques (NoSQL, XSS, CSRF, alçada, adulteração...)
```

## 6. Publicação com HTTPS
> Passo a passo completo e gratuito (Atlas + Render + GitHub Pages + Mailtrap): **[DEPLOY.md](DEPLOY.md)**.

- **Banco**: crie um cluster gratuito no **MongoDB Atlas** (risco de infraestrutura transferido a terceiros) e use a URI em `MONGODB_URI`. Restrinja o acesso por IP.
- **API**: publique `backend/` em um serviço com TLS (Render, Railway, Fly.io). Defina as variáveis do `.env` e `CORS_ORIGINS=https://SEU_USUARIO.github.io`.
- **Frontend no GitHub Pages**: em *Settings → Pages* escolha **GitHub Actions** e marque **Enforce HTTPS**; em *Settings → Secrets and variables → Actions → Variables* crie `API_URL` com a URL HTTPS da API. Cada push na `main` executa [deploy-gh-pages.yml](.github/workflows/deploy-gh-pages.yml). O site fica em `https://SEU_USUARIO.github.io/NOME_DO_REPO/` com certificado TLS do GitHub.
- **E-mail**: configure `SMTP_*` (ex.: senha de app do Gmail ou https://ethereal.email). Sem SMTP, os e-mails aparecem apenas no console.

## 7. Estrutura
```
backend/src
  app.js               Express + Helmet, CORS, sanitização, rate limit
  middleware/          auth (JWT, perfis, CSRF), validação, erros
  models/              User, Expense, Receipt, AuditLog, ServerKey
  routes/              auth, employees, keys, expenses
  services/            crypto (Node Crypto), document (canônico), mailer, audit
frontend/pages         login, dashboard, employees, submitExpense, myExpenses, pendingExpenses,
                       validateExpense, keys, signExpense, signedExpenses, verifySignature
frontend/lib           webcrypto (Web Crypto API), document, api, auth
```
