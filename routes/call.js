import express from "express";
import Call from "../models/Call.js";
import Wallet from "../models/Wallet.js";
import admin from "firebase-admin";

const router = express.Router();
const RATE = 0.0021;
const FREE_SECONDS = 10;

// ✅ START CALL
router.post("/start", async (req, res) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(token);

    const callerId = decoded.uid;
    const { receiverId } = req.body;

    const wallet = await Wallet.findOne({ userId: callerId });
    if (!wallet || wallet.balance <= 0) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const call = await Call.create({
      callerId,
      receiverId,
      ratePerSecond: RATE,
      freeSeconds: FREE_SECONDS,
      startTime: new Date(),
      status: "ringing"
    });

    return res.json({ callId: call._id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Call start failed" });
  }
});

export default router;