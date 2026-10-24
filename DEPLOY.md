# Deploy gratuito

| Parte | Serviço gratuito | O que oferece |
|---|---|---|
| Frontend | **GitHub Pages** | HTTPS com certificado TLS do GitHub |
| API | **Render** (plano Free) | HTTPS automático, deploy a cada push |
| Banco | **MongoDB Atlas** (M0) | 512 MB, backups e criptografia em repouso gerenciados |
| E-mail | **Brevo** | 300 e-mails/dia via SMTP (Nodemailer) |

Ordem: **1 Atlas → 2 GitHub → 3 Brevo → 4 Render → 5 GitHub Pages**. Tempo estimado: 30 minutos.
Substitua `SEU_USUARIO` pelo seu usuário do GitHub e `NOME_DO_REPO` pelo nome do repositório.

---

## 1. MongoDB Atlas (banco)
1. Crie uma conta em https://www.mongodb.com/cloud/atlas/register.
2. **Create cluster** → **M0 (Free)** → provedor **AWS**, região **N. Virginia (us-east-1)** (a mesma do Render).
3. **Database Access** → *Add New Database User* → usuário `assinatura-api`, senha gerada automaticamente (sem caracteres especiais facilita a URI), papel **readWrite** apenas no banco `assinaturas` (*Specific Privileges*).
4. **Network Access** → *Add IP Address* → `0.0.0.0/0`.
   > O Render gratuito não tem IP fixo, então o acesso fica liberado por rede e protegido por usuário/senha forte e TLS (o Atlas exige TLS sempre). Registre isso no trabalho como risco aceito.
5. **Connect** → *Drivers* → copie a URI e acrescente o nome do banco:
   ```
   mongodb+srv://assinatura-api:SENHA@cluster0.xxxxx.mongodb.net/assinaturas?retryWrites=true&w=majority
   ```

## 2. GitHub (código)
1. Crie um repositório **público** em https://github.com/new (o Pages gratuito exige público). Não marque README/.gitignore.
2. Envie o código (o projeto já tem um commit local):
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPO.git
   git push -u origin main
   ```
   O `.gitignore` impede o envio de `.env` e `node_modules`. **Nunca** coloque segredos no repositório.

## 3. Brevo (e-mail)
1. Crie a conta em https://www.brevo.com (plano Free).
2. **Senders, Domains & Dedicated IPs → Senders** → adicione e confirme o e-mail remetente (pode ser seu Gmail).
3. **SMTP & API → SMTP** → gere uma **SMTP key**. Anote o **Login** (algo como `xxxx@smtp-brevo.com`) e a chave.

> Opcional: sem Brevo, deixe `SMTP_HOST` vazio no Render e os e-mails aparecem só nos logs.

## 4. Render (API)
1. Crie a conta em https://render.com com o login do GitHub.
2. **New → Blueprint** → escolha o repositório. O Render lê o [render.yaml](render.yaml) e pede as variáveis:

   | Variável | Valor |
   |---|---|
   | `MONGODB_URI` | URI do passo 1 |
   | `CORS_ORIGINS` | `https://SEU_USUARIO.github.io` (sem barra e sem o nome do repo) |
   | `FRONTEND_URL` | `https://SEU_USUARIO.github.io/NOME_DO_REPO` |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Login do gerente inicial (senha forte) |
   | `SMTP_USER` / `SMTP_PASS` | Login e SMTP key do Brevo |
   | `MAIL_FROM` | `Assinatura Digital <email-verificado-no-brevo@...>` |

   `JWT_SECRET`, `CSRF_SECRET` e `SERVER_KEY_SECRET` são gerados automaticamente (256 bits aleatórios).
3. **Apply**. Após o build, teste: `https://assinatura-digital-api.onrender.com/api/health` → `{"status":"ok"}`.
   Os logs devem mostrar `[seed] gerente inicial criado`.

> **Atenção:** no plano Free a API "dorme" após 15 min sem uso; a primeira requisição leva até ~1 min (a tela de login avisa isso). Para a apresentação, abra o link `/api/health` alguns minutos antes.

## 5. GitHub Pages (frontend)
1. No repositório: **Settings → Secrets and variables → Actions → aba Variables → New repository variable**
   - Nome: `API_URL` · Valor: `https://assinatura-digital-api.onrender.com` (URL exibida no Render, sem barra final)
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Actions → Deploy GitHub Pages → Run workflow** (ou faça qualquer push na `main`).
4. Quando terminar: **Settings → Pages** → marque **Enforce HTTPS**. O site fica em
   `https://SEU_USUARIO.github.io/NOME_DO_REPO/`

---

## Checklist de verificação
- [ ] `/api/health` responde `ok` via HTTPS
- [ ] Login com o gerente funciona no site do GitHub Pages
- [ ] Cadeado HTTPS válido nos dois endereços (frontend e API)
- [ ] Cabeçalhos de segurança: abra https://securityheaders.com e teste a URL da API (Helmet)
- [ ] E-mail de boas-vindas chega ao criar um funcionário

## Problemas comuns
| Sintoma | Causa / solução |
|---|---|
| "Origem não permitida pelo CORS" | `CORS_ORIGINS` deve ser exatamente `https://SEU_USUARIO.github.io` |
| Página em branco / CSS faltando no Pages | O workflow não rodou ou o Source do Pages não é "GitHub Actions" |
| API falha ao iniciar com "segredo fraco" | Segredos precisam de 32+ caracteres aleatórios (os gerados pelo Render já atendem) |
| `MongoServerSelectionError` | IP `0.0.0.0/0` não liberado no Atlas ou senha errada na URI |
| Links dos e-mails quebrados | `FRONTEND_URL` deve incluir `/NOME_DO_REPO` |
| Mudou `API_URL` | Rode o workflow de novo: a URL é embutida no build |
