import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Set Jest worker ID for database connection isolation
process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';

// Configure test timeout (30 seconds for DB queries)
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  // Ensure database connection is ready
  const { sequelize } = await import('../src/config/database');
  await sequelize.authenticate();
});

// Global test teardown
afterAll(async () => {
  // Close database connections
  const { sequelize } = await import('../src/config/database');
  await sequelize.close();
});
