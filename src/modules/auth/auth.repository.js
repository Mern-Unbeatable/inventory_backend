import prisma from '../../config/prisma.js';

const authRepository = {
  findByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        branch: {
          include: { country: true },
        },
      },
    });
  },

  findById(id) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
        branch: {
          include: { country: true },
        },
      },
    });
  },

  findCredentialsById(id) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, password: true },
    });
  },

  updateProfile(id, data) {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
        branch: {
          include: { country: true },
        },
      },
    });
  },

  createRefreshToken({ token, userId, expiresAt }) {
    return prisma.refreshToken.create({
      data: { token, userId, expiresAt },
    });
  },

  findActiveTokensByUserId(userId) {
    return prisma.refreshToken.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
    });
  },

  deleteRefreshToken(token) {
    return prisma.refreshToken.deleteMany({ where: { token } });
  },

  deleteUserRefreshTokens(userId) {
    return prisma.refreshToken.deleteMany({ where: { userId } });
  },
};

export default authRepository;
