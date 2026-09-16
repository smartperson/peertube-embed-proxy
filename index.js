require('dotenv').config();

const { createApp } = require('./src/server');
const config = require('./src/config');

const app = createApp();

app.listen(config.port, () => {
  console.log(JSON.stringify({ msg: 'listening', port: config.port, defaultHost: config.defaultHost }));
});
