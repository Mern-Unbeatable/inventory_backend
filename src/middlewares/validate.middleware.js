import ApiError from '../utils/ApiError.js';

/**
 * Validates req.body / req.query / req.params with Zod schemas.
 * Usage: validate({ body: schema, query: schema, params: schema })
 */
const validate = (schemas) => (req, _res, next) => {
  try {
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    if (schemas.query) {
      req.query = schemas.query.parse(req.query);
    }
    if (schemas.params) {
      req.params = schemas.params.parse(req.params);
    }
    next();
  } catch (error) {
    if (error?.name === 'ZodError') {
      const details = error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    return next(error);
  }
};

export default validate;
