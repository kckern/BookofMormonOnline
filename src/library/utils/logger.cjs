const winston = require('winston');
require('winston-syslog');

const papertrail = new winston.transports.Syslog({
  host: process.env.LOG_HOST,
  port: process.env.LOG_PORT,
  protocol: 'tls4',
  localhost: process.env.HOST,
  eol: '\n',
});

const logger = winston.createLogger({
  format: winston.format.simple(),
  levels: winston.config.syslog.levels,
  transports: [papertrail],
  info: function(msg) {
    this.log({
      level: 'info',
      message: msg,
      timestamp: new Date().toISOString(),
    });
  },
});




module.exports = logger;