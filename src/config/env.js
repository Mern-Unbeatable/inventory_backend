import dotenv from 'dotenv';

dotenv.config();

const required = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongodbUri: process.env.MONGODB_URI,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    publicPath: process.env.UPLOAD_PUBLIC_PATH || '/uploads',
    maxFileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE) || 2 * 1024 * 1024,
  },
};

export default env;
