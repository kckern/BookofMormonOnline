import { Sequelize, QueryTypes } from 'sequelize';
import { logInfo, logWarn, logError } from '../../library/utils/logger';

// Re-export QueryTypes as SQLQueryTypes for backward compatibility
export { QueryTypes as SQLQueryTypes } from 'sequelize';

const {
  MYSQL_DB,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_HOST,
  MYSQL_PORT,
  DB_POOL_ACQUIRE,
  DB_POOL_IDLE,
  DB_POOL_MAX_CONN,
  DB_POOL_MIN_CONN
} = process.env;

export const sequelize = new Sequelize(
  MYSQL_DB!,
  MYSQL_USER!,
  MYSQL_PASSWORD!,
  {
    dialect: 'mysql',
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT) || 3306,
    logging: false,
    pool: {
      acquire: Number(DB_POOL_ACQUIRE) || 60000,
      idle: Number(DB_POOL_IDLE) || 30000,
      max: Number(DB_POOL_MAX_CONN) || 8,
      min: Number(DB_POOL_MIN_CONN) || 4,
      evict: 10000
    },
    define: {
      timestamps: false,
      freezeTableName: true
    },
    retry: {
      max: 3,
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ESOCKETTIMEDOUT/,
        /EPIPE/,
        /EAI_AGAIN/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ]
    }
  }
);

export const initializeDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logInfo('Database connection established');
  } catch (error) {
    logError('Database connection failed', error as Error);
    throw error;
  }
};

export const closeDatabase = async (): Promise<void> => {
  await sequelize.close();
  logInfo('Database connection closed');
};

// Pool monitoring - only logs warnings when pool is stressed
// Returns null during tests (JEST_WORKER_ID is set)
export const startPoolMonitoring = (intervalMs: number = 60000): NodeJS.Timeout | null => {
  if (process.env.JEST_WORKER_ID) return null;
  return setInterval(() => {
    const pool = (sequelize.connectionManager as any).pool;
    if (pool) {
      const maxConn = Number(DB_POOL_MAX_CONN) || 8;
      // Only log when pool usage is high (>75% of max)
      if (pool.size > maxConn * 0.75) {
        logWarn('Pool pressure detected', {
          size: pool.size,
          max: maxConn,
          available: pool.available,
          used: pool.size - pool.available
        });
      }
      // Critical warning at max capacity
      if (pool.size >= maxConn && pool.available === 0) {
        logError('Connection pool exhausted', undefined, {
          size: pool.size,
          pending: pool.pending
        });
      }
    }
  }, intervalMs);
};

// Graceful shutdown handler
let isShuttingDown = false;

export const setupGracefulShutdown = (): void => {
  const handleShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logInfo(`${signal} received. Closing database connections...`);
    try {
      await closeDatabase();
    } catch (err) {
      logError('Error closing database connections', err as Error);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
};
