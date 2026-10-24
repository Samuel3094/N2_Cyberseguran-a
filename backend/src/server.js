const config = require('./config');
const { connect } = require('./db');
const app = require('./app');
const seed = require('./seed');
const { getServerKeys } = require('./services/crypto');

async function main() {
  await connect();
  await seed();
  await getServerKeys(); // gera/carrega a chave do carimbo de tempo
  app.listen(config.port, () => console.log(`[api] ouvindo na porta ${config.port}`));
}

main().catch((err) => {
  console.error('[api] falha ao iniciar:', err.message);
  process.exit(1);
});
