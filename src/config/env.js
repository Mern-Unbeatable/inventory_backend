import dotenv from "dotenv";

dotenv.config();

const required = ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const defaultCorsOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
  "http://localhost:4174",
  "https://kglowskincare.kglowskincarekorea.com",
];

const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongodbUri: process.env.MONGODB_URI,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  isDev: (process.env.NODE_ENV || "development") === "development",
  corsOrigins: corsOrigins.length > 0 ? corsOrigins : defaultCorsOrigins,
  upload: {
    dir: process.env.UPLOAD_DIR || "uploads",
    publicPath: process.env.UPLOAD_PUBLIC_PATH || "/uploads",
    maxFileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE) || 2 * 1024 * 1024,
  },
  r2: {
    bucket: process.env.R2_BUCKET_NAME || "",
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    endpoint: process.env.R2_ENDPOINT || "",
    publicUrl: process.env.R2_PUBLIC_URL || "",
    region: process.env.R2_REGION || "auto",
  },
  storageProvider:
    process.env.STORAGE_PROVIDER ||
    (process.env.R2_BUCKET_NAME &&
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_ENDPOINT &&
    process.env.R2_PUBLIC_URL
      ? "r2"
      : "local"),
  company: {
    name: process.env.COMPANY_NAME || "K Glow Skin Care",
    address: process.env.COMPANY_ADDRESS || "",
    phone: process.env.COMPANY_PHONE || "",
    email: process.env.COMPANY_EMAIL || "",
    website:
      process.env.COMPANY_WEBSITE || "https://kglowskincarekorea.com/",
    logoPath: process.env.COMPANY_LOGO_PATH || "",
    footer: process.env.COMPANY_FOOTER || "Thank you for your business.",
  },
};

export default env;
