// Cria o gerente inicial (se não houver usuários). Executado no start e via "npm run seed".
const bcrypt = require('bcryptjs');
const config = require('./config');
const User = require('./models/User');

async function seed() {
  if ((await User.estimatedDocumentCount()) > 0) return;
  if (!config.admin.email || !config.admin.password) {
    console.warn('[seed] ADMIN_EMAIL/ADMIN_PASSWORD não definidos: nenhum usuário inicial criado');
    return;
  }
  await User.create({
    name: config.admin.name,
    email: config.admin.email.toLowerCase(),
    cpf: '52998224725', // CPF fictício válido apenas para demonstração
    department: 'Diretoria',
    position: 'Gerente',
    role: 'GERENTE',
    passwordHash: await bcrypt.hash(config.admin.password, 12),
  });
  console.log(`[seed] gerente inicial criado: ${config.admin.email}`);
}

module.exports = seed;

if (require.main === module) {
  const { connect, mongoose } = require('./db');
  connect()
    .then(seed)
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
