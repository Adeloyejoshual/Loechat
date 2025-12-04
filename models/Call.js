import mongoose from "mongoose";

const CallSchema = new mongoose.Schema({
  callerId: { type: String, required: true },
  receiverId: { type: String, required: true },

  status: {
    type: String,
    enum: ["ringing", "active", "ended"],
    default: "ringing"
  },

  ratePerSecond: { type: Number, default: 0.0021 },
  freeSeconds: { type: Number, default: 10 },

  startTime: Date,
  endTime: Date,

  totalSeconds: { type: Number, default: 0 },
  cost: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model("Call", CallSchema);