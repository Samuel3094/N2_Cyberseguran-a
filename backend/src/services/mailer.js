// Notificações por e-mail com Nodemailer
const nodemailer = require('nodemailer');
const config = require('../config');

const transporter = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      requireTLS: !config.smtp.secure, // exige STARTTLS quando não usa TLS direto
    })
  : nodemailer.createTransport({ jsonTransport: true }); // desenvolvimento: só registra no console

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function sendMail({ to, subject, lines, link }) {
  const recipients = [].concat(to).filter(Boolean);
  if (!recipients.length) return;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px">
      <h2 style="color:#1e3a8a">Assinatura Digital</h2>
      ${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}
      ${link ? `<p><a href="${encodeURI(link)}">Abrir no sistema</a></p>` : ''}
      <hr/><small>Mensagem automática. Não responda.</small>
    </div>`;
  try {
    const info = await transporter.sendMail({
      from: config.smtp.from,
      to: recipients.join(','),
      subject,
      text: lines.join('\n') + (link ? `\n\n${link}` : ''),
      html,
    });
    if (!config.smtp.host) console.log(`[mail:dev] para=${recipients.join(',')} assunto="${subject}"`);
    return info;
  } catch (err) {
    // Falha de e-mail não deve desfazer a operação de negócio
    console.error('[mail] falha ao enviar:', err.message);
  }
}

module.exports = { sendMail };
