import Call from "../models/Call.js";
import Wallet from "../models/Wallet.js";

const RATE = 0.0021;
const FREE_SECONDS = 10;

setInterval(async () => {
  const activeCalls = await Call.find({ status: "ringing" });

  for (const call of activeCalls) {
    const wallet = await Wallet.findOne({ userId: call.callerId });
    if (!wallet) continue;

    const now = new Date();
    const seconds = Math.floor((now - call.startTime) / 1000);
    const billable = Math.max(0, seconds - FREE_SECONDS);
    const cost = +(billable * RATE).toFixed(4);

    if (wallet.balance <= cost) {
      call.status = "ended";
      call.endTime = now;
      call.cost = wallet.balance;
      call.totalSeconds = seconds;

      wallet.balance = 0;

      await call.save();
      await wallet.save();
    }
  }
}, 1000);