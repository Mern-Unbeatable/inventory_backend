import { verifyAccessToken } from '../utils/jwt.js';
import ApiError from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';
import { User } from '../models/User.js';

/**
 * Verifies Bearer JWT and attaches req.user (id, email, role, branchId).
 */
const authenticate = catchAsync(async (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Access token is required');
  }

  const token = header.slice(7).trim();
  if (!token) {
    throw ApiError.unauthorized('Access token is required');
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }

  const user = await User.findById(decoded.sub).select('name email role branchId');
  if (!user) {
    throw ApiError.unauthorized('User no longer exists');
  }

  req.user = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
  };
  next();
});

export default authenticate;
