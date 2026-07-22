import ApiError from '../utils/ApiError.js';

/**
 * Restricts route access to one or more roles.
 * Usage: authorize('ADMIN') or authorize('ADMIN', 'SELLER')
 */
const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }

    return next();
  };

export default authorize;
