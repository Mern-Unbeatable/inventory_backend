import { ZodError } from 'zod';
import mongoose from 'mongoose';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const notFoundHandler = (_req, _res, next) => {
  next(ApiError.notFound('Route not found'));
};

const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors || null;

  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    errors = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
  }

  // Mongo duplicate key (unique index) — equivalent to Prisma P2002
  if (err?.code === 11000) {
    statusCode = 409;
    const fields = err.keyPattern ? Object.keys(err.keyPattern).join(', ') : 'field';
    message = `Duplicate value for unique field(s): ${fields}`;
  }

  if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = 'Invalid related resource reference';
  }

  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({
      path: e.path,
      message: e.message,
    }));
  }

  if (!(err instanceof ApiError) && statusCode === 500) {
    message = env.isDev ? err.message : 'Internal server error';
  }

  const payload = {
    success: false,
    message,
    ...(errors ? { errors } : {}),
    ...(env.isDev && statusCode === 500 ? { stack: err.stack } : {}),
  };

  res.status(statusCode).json(payload);
};

export { notFoundHandler, errorHandler };
