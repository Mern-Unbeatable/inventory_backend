import app from './app.js';
import env from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/mongoose.js';
// import { logStorageConfig } from './utils/logStorageConfig.js';

const startServer = async () => {
  try {
    // logStorageConfig();
    await connectDatabase();
    console.log('🎉 Database connected');

    app.listen(env.port, () => {
      console.log(`Server running in "${env.nodeEnv}" mode`);
      console.log(`Server running on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down...`);
  await disconnectDatabase();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
