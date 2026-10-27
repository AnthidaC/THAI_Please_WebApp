import app from './app';
import { env } from './config/env';
import { connectRedis } from './utils/redis';
import { prisma } from './utils/prisma';
import { registerAchievementHandlers } from './services/achievements/handlers';

// Badge conditions must be registered before any request can award or display one.
registerAchievementHandlers();

const startServer = async () => {
  try {
    // Test DB connection
    await prisma.$connect();
    console.log('🐘 PostgreSQL connected successfully');

    // Connect Redis
    await connectRedis();

    app.listen(env.PORT, () => {
      console.log(`🚀 Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
