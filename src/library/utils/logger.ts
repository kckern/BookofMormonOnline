import winston from 'winston';
import 'winston-syslog';

const { PAPERTRAIL_HOST, PAPERTRAIL_PORT, NODE_ENV, LOG_LEVEL } = process.env;

const formatMeta = (meta: Record<string, unknown>) => {
  const cleaned = { ...meta };
  delete cleaned.level;
  delete cleaned.message;
  delete cleaned.timestamp;
  return Object.keys(cleaned).length ? JSON.stringify(cleaned) : '';
};

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = formatMeta(meta);
    return `${timestamp} ${level}: ${message}${metaStr ? ` ${metaStr}` : ''}`;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat,
    level: LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug')
  })
];

if (PAPERTRAIL_HOST && PAPERTRAIL_PORT) {
  transports.push(
    new (winston.transports as any).Syslog({
      host: PAPERTRAIL_HOST,
      port: parseInt(PAPERTRAIL_PORT, 10),
      protocol: 'tls4',
      localhost: 'bom-api',
      app_name: 'bookofmormon',
      format: winston.format.json()
    })
  );
}

export const logger = winston.createLogger({
  level: LOG_LEVEL || 'info',
  defaultMeta: { service: 'bom-api' },
  transports
});

// Convenience methods with context
export const logInfo = (message: string, meta?: Record<string, unknown>) =>
  logger.info(message, meta);

export const logError = (message: string, error?: Error, meta?: Record<string, unknown>) =>
  logger.error(message, { error: error?.message, stack: error?.stack, ...meta });

export const logWarn = (message: string, meta?: Record<string, unknown>) =>
  logger.warn(message, meta);

export const logDebug = (message: string, meta?: Record<string, unknown>) =>
  logger.debug(message, meta);

export default logger;
