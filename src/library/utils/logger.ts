import * as winston from 'winston';
import 'winston-syslog';

interface PapertrailConfig {
  host: string | undefined;
  port: string | undefined;
  protocol: 'tls4';
  localhost: string | undefined;
  eol: string;
}

const papertrailConfig: PapertrailConfig = {
  host: process.env.LOG_HOST,
  port: process.env.LOG_PORT,
  protocol: 'tls4',
  localhost: process.env.HOST,
  eol: '\n',
};

// Type assertion to handle winston-syslog
const papertrail = new (winston.transports as any).Syslog(papertrailConfig);

const logger: winston.Logger = winston.createLogger({
  format: winston.format.simple(),
  levels: winston.config.syslog.levels,
  transports: [papertrail]
});

export default logger;