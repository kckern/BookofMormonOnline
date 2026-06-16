import winston from 'winston';

const { NODE_ENV, LOG_LEVEL } = process.env;

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

export const logger = winston.createLogger({
  level: LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug'),
  defaultMeta: { service: 'bom-api' },
  transports: [new winston.transports.Console({ format: consoleFormat })]
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
