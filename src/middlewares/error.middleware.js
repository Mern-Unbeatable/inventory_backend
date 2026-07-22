import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
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

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      const fields = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field';
      message = `Duplicate value for unique field(s): ${fields}`;
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Record not found';
    } else if (err.code === 'P2003') {
      statusCode = 400;
      message = 'Invalid related resource reference';
    }
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
