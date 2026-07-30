import { User } from '../../models/User.js';
import { Branch } from '../../models/Branch.js';
import { UserProduct } from '../../models/UserProduct.js';
import { Sale } from '../../models/Sale.js';
import { RefreshToken } from '../../models/RefreshToken.js';
import { toApi } from '../../utils/mongooseHelpers.js';
import { containsInsensitive } from '../../utils/queryHelpers.js';

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
      id: branch.id,
      name: branch.name,
      code: branch.code,
      countryId: country?.id ?? (typeof branch.countryId === 'string' ? branch.countryId : null),
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
      country,
    };
    json.branchId = branch.id;
  } else {
    json.branch = null;
  }
  delete json.password;
  return json;
};

const userRepository = {
  async create(data) {
    const user = await User.create(data);
    const populated = await User.findById(user._id)
      .select('-password')
      .populate(branchCountryPopulate);
    return mapUserWithBranch(populated);
  },

  async findById(id) {
    const user = await User.findById(id)
      .select('-password')
      .populate(branchCountryPopulate);
    return mapUserWithBranch(user);
  },

  async findByEmail(email) {
    const user = await User.findOne({ email });
    return user ? toApi(user) : null;
  },

  async findMany({ filters = {}, skip = 0, take = 20 }) {
    const query = {};

    if (filters.roles) {
      query.role = { $in: filters.roles };
    } else if (filters.role) {
      query.role = filters.role;
    }
    if (filters.branchId) query.branchId = filters.branchId;

    if (filters.countryId) {
      const branchIds = await Branch.find({ countryId: filters.countryId }).distinct('_id');
      query.branchId = { $in: branchIds };
    }

    if (filters.search) {
      query.$or = [
        { name: containsInsensitive(filters.search) },
        { email: containsInsensitive(filters.search) },
      ];
    }

    const [rows, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .populate(branchCountryPopulate)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take),
      User.countDocuments(query),
    ]);

    return { users: rows.map(mapUserWithBranch), total };
  },

  async update(id, data) {
    const user = await User.findByIdAndUpdate(id, data, { new: true })
      .select('-password')
      .populate(branchCountryPopulate);
    return mapUserWithBranch(user);
  },

  async delete(id) {
    const user = await User.findById(id).select('_id email');
    if (!user) return null;

    await Promise.all([
      UserProduct.deleteMany({ userId: id }),
      Sale.deleteMany({ userId: id }),
      RefreshToken.deleteMany({ userId: id }),
      User.deleteOne({ _id: id }),
    ]);

    return { id: user._id, email: user.email };
  },

  async branchExists(branchId) {
    const branch = await Branch.findById(branchId).select('_id');
    return branch ? { id: branch._id } : null;
  },
};

export default userRepository;
