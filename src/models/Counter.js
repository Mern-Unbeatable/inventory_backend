import mongoose from 'mongoose';

/**
 * Atomic sequence generator (findOneAndUpdate $inc) for human-readable
 * numbers (e.g. invoiceNumber) that live alongside the UUID `_id` convention.
 * `_id` here is the counter's name (e.g. "invoice"), not a UUID.
 */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { collection: 'counters' }
);

export const Counter = mongoose.model('Counter', counterSchema);

export const getNextSequence = async (name) => {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return counter.seq;
};
