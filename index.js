require('dotenv').config();

const { createApp } = require('./src/server');
const config = require('./src/config');
const logger = require('./src/logger');

const app = createApp();

app.listen(config.port, () => {
  logger.info('listening', { port: config.port, defaultHost: config.defaultHost, logLevel: config.logLevel });
});
