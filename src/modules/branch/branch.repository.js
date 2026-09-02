import { Country } from "../../models/Country.js";
import { Branch } from "../../models/Branch.js";
import { User } from "../../models/User.js";
import { toApi } from "../../utils/mongooseHelpers.js";
import { containsInsensitive } from "../../utils/queryHelpers.js";

const mapCountry = async (doc, { withBranches = false } = {}) => {
  if (!doc) return null;
  const json = toApi(doc);
  const branchCount = await Branch.countDocuments({ countryId: json.id });
  json._count = { branches: branchCount };

  if (withBranches) {
    const branches = await Branch.find({ countryId: json.id }).sort({
      name: 1,
    });
    json.branches = branches.map(toApi);
  }

  return json;
};

const mapBranch = async (doc) => {
  if (!doc) return null;
  const json = toApi(doc);
  const country =
    json.countryId && typeof json.countryId === "object"
      ? json.countryId
      : null;

  if (country) {
    json.country = country;
    json.countryId = country.id;
  } else if (typeof json.countryId === "string") {
    json.country = null;
  }

  const usersCount = await User.countDocuments({ branchId: json.id });
  json._count = { users: usersCount };
  return json;
};

const branchRepository = {
  async createCountry(data) {
    const country = await Country.create(data);
    return mapCountry(country);
  },

  async findCountryById(id) {
    const country = await Country.findById(id);
    return mapCountry(country, { withBranches: true });
  },

  async findAllCountries() {
    const countries = await Country.find().sort({ name: 1 });
    return Promise.all(countries.map((c) => mapCountry(c)));
  },

  async updateCountry(id, data) {
    const country = await Country.findByIdAndUpdate(id, data, { new: true });
    return mapCountry(country);
  },

  async deleteCountry(id) {
    const country = await Country.findById(id);
    if (!country) return null;

    const branchIds = await Branch.find({ countryId: id }).distinct("_id");
    await User.updateMany(
      { branchId: { $in: branchIds } },
      { $set: { branchId: null } },
    );
    await Branch.deleteMany({ countryId: id });
    await Country.deleteOne({ _id: id });
    return toApi(country);
  },

  async createBranch(data) {
    const branch = await Branch.create(data);
    const populated = await Branch.findById(branch._id).populate("countryId");
    return mapBranch(populated);
  },

  async findBranchById(id) {
    const branch = await Branch.findById(id).populate("countryId");
    return mapBranch(branch);
  },

  async findManyBranches({ filters = {}, skip = 0, take = 20 }) {
    const query = {};
    if (filters.countryId) query.countryId = filters.countryId;
    if (filters.branchId) query._id = filters.branchId;
    if (filters.search) {
      query.$or = [
        { name: containsInsensitive(filters.search) },
        { code: containsInsensitive(filters.search) },
      ];
    }

    const [rows, total] = await Promise.all([
      Branch.find(query)
        .populate("countryId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take),
      Branch.countDocuments(query),
    ]);

    const items = await Promise.all(rows.map((row) => mapBranch(row)));
    return { items, total };
  },

  async updateBranch(id, data) {
    const branch = await Branch.findByIdAndUpdate(id, data, {
      new: true,
    }).populate("countryId");
    return mapBranch(branch);
  },

  async deleteBranch(id) {
    const branch = await Branch.findById(id).populate("countryId");
    if (!branch) return null;

    await User.updateMany({ branchId: id }, { $set: { branchId: null } });
    await Branch.deleteOne({ _id: id });
    return mapBranch(branch);
  },

  async findManyByIds(ids) {
    return Branch.find({ _id: { $in: ids } })
      .select("_id")
      .lean();
  },

  async bulkDeleteBranches(ids) {
    const branches = await Branch.find({ _id: { $in: ids } }).select("_id");
    if (!branches.length) return 0;

    await Promise.all([
      User.updateMany({ branchId: { $in: ids } }, { $set: { branchId: null } }),
      Branch.deleteMany({ _id: { $in: ids } }),
    ]);

    return branches.length;
  },
};

export default branchRepository;
