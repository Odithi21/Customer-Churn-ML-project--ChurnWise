const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { createApp, prisma } = require('./app');

const port = Number(process.env.BACKEND_PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('BACKEND_PORT must be an integer between 1 and 65535.');
}

const app = createApp();
const server = app.listen(port, () => {
  console.log(`ChurnWise backend listening on port ${port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);