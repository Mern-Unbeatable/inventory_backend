import { User } from '../../models/User.js';
import { RefreshToken } from '../../models/RefreshToken.js';
import { toApi } from '../../utils/mongooseHelpers.js';

const branchCountryPopulate = {
  path: 'branchId',
  populate: { path: 'countryId' },
};

const mapUserWithBranch = (doc) => {
  if (!doc) return null;
  const json = toApi(doc);
  const branch = json.branchId && typeof json.branchId === 'object' ? json.branchId : null;
  if (branch) {
    const country =
      branch.countryId && typeof branch.countryId === 'object' ? branch.countryId : null;
    json.branch = {
      ...branch,
      countryId: country?.id ?? branch.countryId ?? null,
      country,
    };
    delete json.branch.countryId;
    if (json.branch.country) {
      // country already has id from toApi
    }
    json.branchId = json.branch.id;
  } else {
    json.branch = null;
    json.branchId = json.branchId ?? null;
  }
  return json;
};

const authRepository = {
  async findByEmail(email) {
    const user = await User.findOne({ email }).populate(branchCountryPopulate);
    if (!user) return null;
    const mapped = mapUserWithBranch(user);
    mapped.password = user.password;
    return mapped;
  },

  async findById(id) {
    const user = await User.findById(id)
      .select('-password')
      .populate(branchCountryPopulate);
    return mapUserWithBranch(user);
  },

  async findCredentialsById(id) {
    const user = await User.findById(id).select('_id password');
    if (!user) return null;
    return { id: user._id, password: user.password };
  },

  async updateProfile(id, data) {
    const user = await User.findByIdAndUpdate(id, data, { new: true })
      .select('-password')
      .populate(branchCountryPopulate);
    return mapUserWithBranch(user);
  },

  async createRefreshToken({ token, userId, expiresAt }) {
    const row = await RefreshToken.create({ token, userId, expiresAt });
    return toApi(row);
  },

  async findActiveTokensByUserId(userId) {
    const rows = await RefreshToken.find({
      userId,
      expiresAt: { $gt: new Date() },
    });
    return rows.map(toApi);
  },

  async deleteRefreshToken(token) {
    await RefreshToken.deleteMany({ token });
  },

  async deleteUserRefreshTokens(userId) {
    await RefreshToken.deleteMany({ userId });
  },
};

export default authRepository;
