import authRepository from './auth.repository.js';
import ApiError from '../../utils/ApiError.js';
import {
  comparePassword,
  hashPassword,
  hashToken,
  compareToken,
} from '../../utils/bcrypt.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import env from '../../config/env.js';

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
};

const buildTokenPayload = (user) => ({
  sub: user.id,
  email: user.email,
  role: user.role,
  branchId: user.branchId ?? null,
});

const getRefreshExpiryDate = () => {
  const match = /^(\d+)([smhd])$/.exec(env.jwt.refreshExpiresIn);
  const now = Date.now();
  if (!match) {
    return new Date(now + 7 * 24 * 60 * 60 * 1000);
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(now + value * multipliers[unit]);
};

const findMatchingRefreshToken = async (userId, refreshToken) => {
  const storedTokens = await authRepository.findActiveTokensByUserId(userId);
  for (const row of storedTokens) {
    const ok = await compareToken(refreshToken, row.token);
    if (ok) return row;
  }
  return null;
};

const issueTokenPair = async (user) => {
  const payload = buildTokenPayload(user);
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const tokenHash = await hashToken(refreshToken);

  await authRepository.createRefreshToken({
    token: tokenHash,
    userId: user.id,
    expiresAt: getRefreshExpiryDate(),
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: env.jwt.accessExpiresIn,
  };
};

const authService = {
  async login({ email, password }) {
    const user = await authRepository.findByEmail(email.toLowerCase());
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const tokens = await issueTokenPair(user);

    return {
      user: sanitizeUser(user),
      tokens,
    };
  },

  async refresh(refreshToken) {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const matched = await findMatchingRefreshToken(decoded.sub, refreshToken);
    if (!matched) {
      throw ApiError.unauthorized('Refresh token is invalid or revoked');
    }

    await authRepository.deleteRefreshToken(matched.token);

    const user = await authRepository.findById(decoded.sub);
    if (!user) {
      throw ApiError.unauthorized('User no longer exists');
    }

    const tokens = await issueTokenPair(user);
    return { tokens };
  },

  async logout(refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const matched = await findMatchingRefreshToken(decoded.sub, refreshToken);
      if (matched) {
        await authRepository.deleteRefreshToken(matched.token);
      }
    } catch {
      // Idempotent logout
    }

    return { loggedOut: true };
  },

  async me(userId) {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    return user;
  },

  async updateProfile(userId, payload) {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const data = {};
    if (payload.name !== undefined) {
      data.name = payload.name;
    }

    if (payload.email !== undefined) {
      const email = payload.email.toLowerCase();
      const existing = await authRepository.findByEmail(email);
      if (existing && existing.id !== userId) {
        throw ApiError.conflict('Email already registered');
      }
      data.email = email;
    }

    return authRepository.updateProfile(userId, data);
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await authRepository.findCredentialsById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) {
      throw ApiError.badRequest('Current password is incorrect');
    }

    const hashed = await hashPassword(newPassword);
    await authRepository.updateProfile(userId, { password: hashed });
    await authRepository.deleteUserRefreshTokens(userId);

    return { updated: true };
  },
};

export default authService;
