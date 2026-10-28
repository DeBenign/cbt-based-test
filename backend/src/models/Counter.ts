import { Schema, model } from "mongoose";

// Tiny atomic counters (used for receipt numbers).
const counterSchema = new Schema<{ _id: string; seq: number }>({
  _id: { type: String },
  seq: { type: Number, default: 0 }
});

export default model("Counter", counterSchema);
