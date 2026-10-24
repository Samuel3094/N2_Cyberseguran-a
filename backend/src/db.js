const mongoose = require('mongoose');
const config = require('./config');

// Ignora campos de filtro que não existem no schema (defesa extra contra injeção NoSQL).
// A remoção de operadores "$" vindos do cliente é feita pelo express-mongo-sanitize (app.js).
mongoose.set('strictQuery', true);

async function connect() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log('[db] conectado ao MongoDB');
}

module.exports = { connect, mongoose };
