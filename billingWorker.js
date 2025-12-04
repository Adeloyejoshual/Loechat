// billingWorker.js
// Durable Billing Worker for per-second call billing (micro-units)
// Requirements:
// - MongoDB replica set (transactions support recommended)
// - Firebase service account JSON (path in FIREBASE_CERT_PATH env var)
// - Environment variables (see .env.example)
// - Node >= 18 recommended

const mongoose = require('mongoose');
const admin = require('firebase-admin');
const express = require('express');

require('dotenv').config();

// Config (from env)
const MONGO_URI = process.env.MONGO_URI;
const FIREBASE_CERT_PATH = process.env.FIREBASE_CERT_PATH; // path to service account JSON in container
const FIRESTORE_PROJECT = process.env.FIRESTORE_PROJECT;
const RATE_MICROS = parseInt(process.env.RATE_MICROS || '2100', 10); // 2100 micro-dollars per sec
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '1000', 10); // worker loop interval
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100', 10); // calls per loop
const PORT = parseInt(process.env.PORT || '4000', 10);

// Basic sanity check
if (!MONGO_URI) throw new Error('MONGO_URI missing in env');
if (!FIREBASE_CERT_PATH) throw new Error('FIREBASE_CERT_PATH missing in env');
if (!FIRESTORE_PROJECT) throw new Error('FIRESTORE_PROJECT missing in env');

// initialize firebase admin
admin.initializeApp({
  credential: admin.credential.cert(require(FIREBASE_CERT_PATH)),
  projectId: FIRESTORE_PROJECT
});

const firestore = admin.firestore();

// Mongoose models
const walletSchema = new mongoose.Schema({
  userId: { type: String, index: true, unique: true },
  balanceMicros: { type: Number, default: 0 }, // integer micro-dollars
  updatedAt: Date
}, { strict: true });

const callSchema = new mongoose.Schema({
  callId: { type: String, index: true, unique: true },
  callerId: { type: String, index: true },
  calleeId: String,
  status: { type: String, index: true }, // 'connected', 'ended', 'ringing', etc
  startedAt: Date,
  lastBilledAt: Date,
  secondsUsed: { type: Number, default: 0 },
  amountChargedMicros: { type: Number, default: 0 },
  rateMicrosPerSecond: { type: Number, default: RATE_MICROS },
  freeUntil: Date, // optional free window end
  createdAt: Date,
  endedAt: Date,
  reason: String
}, { strict: true });

const txSchema = new mongoose.Schema({
  userId: String,
  callId: String,
  secondsBilled: Number,
  amountMicros: Number,
  createdAt: Date
}, { strict: true });

const Wallet = mongoose.model('Wallet', walletSchema);
const Call = mongoose.model('Call', callSchema);
const Tx = mongoose.model('Tx', txSchema);

// small express server for health checks and metrics
const app = express();
app.get('/health', async (req, res) => {
  try {
    const mongoOk = mongoose.connection.readyState === 1;
    return res.json({ ok: true, mongoReady: mongoOk });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});
app.listen(PORT, () => console.log(`Billing worker health server listening on ${PORT}`));

// connect mongoose
async function connectMongo() {
  console.log('Connecting to Mongo...');
  await mongoose.connect(MONGO_URI, {
    // recommended options
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000
  });
  console.log('Mongo connected');
}

// Helper: notify clients (Firestore) for a call
async function notifyCallEnded(callId, payload = {}) {
  try {
    const docRef = firestore.collection('calls').doc(callId);
    await docRef.set({ status: 'ended', endedAt: admin.firestore.FieldValue.serverTimestamp(), ...payload }, { merge: true });
  } catch (err) {
    console.error('notifyCallEnded error', err);
  }
}

async function notifyCallUpdated(callId, data = {}) {
  try {
    const docRef = firestore.collection('calls').doc(callId);
    await docRef.set(data, { merge: true });
  } catch (err) {
    console.error('notifyCallUpdated error', err);
  }
}

// Main worker loop
let running = true;
async function processBillingLoop() {
  while (running) {
    const now = new Date();

    try {
      // Claim candidate calls that are connected and need billing:
      // We will look for calls with status='connected' and either lastBilledAt <= now-1s or never billed
      const cutoff = new Date(now.getTime() - POLL_INTERVAL_MS);
      const candidates = await Call.find({
        status: 'connected',
        // exclude calls still in free window
        $or: [
          { lastBilledAt: { $lte: cutoff } },
          { lastBilledAt: { $exists: false } }
        ],
        $expr: {
          // ensure freeUntil either not set OR freeUntil < now
          $lt: [
            { $ifNull: ['$freeUntil', new Date(0)] },
            now
          ]
        }
      }).limit(BATCH_SIZE).lean();

      if (!candidates || candidates.length === 0) {
        // nothing to bill now
        await sleep(Math.max(100, POLL_INTERVAL_MS));
        continue;
      }

      // For each candidate call attempt to atomically decrement wallet and update call/tx
      for (const c of candidates) {
        try {
          // atomic decrement wallet by RATE_MICROS, only if balance >= rate (check also freeUntil)
          // Note: We skip billing if call.freeUntil > now (free window)
          if (c.freeUntil && new Date(c.freeUntil) > now) {
            // update lastBilledAt so it's not picked up until free window expires
            await Call.updateOne({ callId: c.callId, status: 'connected' }, { $set: { lastBilledAt: now } });
            continue;
          }

          // Attempt atomic decrement
          const walletUpdate = await Wallet.findOneAndUpdate(
            { userId: c.callerId, balanceMicros: { $gte: c.rateMicrosPerSecond || RATE_MICROS } },
            { $inc: { balanceMicros: -(c.rateMicrosPerSecond || RATE_MICROS) }, $set: { updatedAt: new Date() } },
            { new: true }
          ).lean();

          if (!walletUpdate) {
            // insufficient funds -> end the call
            console.log(`Insufficient funds for caller ${c.callerId} on call ${c.callId}; ending call`);
            await Call.findOneAndUpdate({ callId: c.callId, status: 'connected' }, {
              $set: { status: 'ended', endedAt: new Date(), reason: 'insufficient_funds' }
            });

            // notify Firestore clients
            await notifyCallEnded(c.callId, { reason: 'insufficient_funds' });
            continue;
          }

          // We successfully charged one second. Use a transaction to update call + insert tx row for stronger consistency.
          const session = await mongoose.startSession();
          try {
            session.startTransaction();

            const rateThis = c.rateMicrosPerSecond || RATE_MICROS;

            await Call.updateOne({ callId: c.callId }, {
              $inc: { secondsUsed: 1, amountChargedMicros: rateThis },
              $set: { lastBilledAt: new Date() }
            }, { session });

            await Tx.create([{
              userId: c.callerId,
              callId: c.callId,
              secondsBilled: 1,
              amountMicros: rateThis,
              createdAt: new Date()
            }], { session });

            await session.commitTransaction();
            session.endSession();

            // Optionally notify Firestore clients about updated secondsUsed/balance
            await notifyCallUpdated(c.callId, {
              secondsUsed: (c.secondsUsed || 0) + 1,
              lastBilledAt: admin.firestore.FieldValue.serverTimestamp()
            });

          } catch (txErr) {
            await session.abortTransaction();
            session.endSession();
            console.error('Transaction error billing for call', c.callId, txErr);
            // In case of transaction failure, consider reconciling later; do not attempt to roll back walletUpdate here.
          }
        } catch (innerErr) {
          console.error('Error billing candidate call', c.callId, innerErr);
        }
      }
    } catch (err) {
      console.error('Billing loop error', err);
      // on serious unexpected error, wait briefly before retrying
      await sleep(1000);
    }

    // loop pacing
    await sleep(Math.max(50, POLL_INTERVAL_MS));
  }
}

// util
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// graceful shutdown
async function shutdown() {
  console.log('Shutting down billing worker...');
  running = false;
  try { await mongoose.disconnect(); } catch (e) {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// run
(async () => {
  try {
    await connectMongo();
    processBillingLoop().catch(err => {
      console.error('Fatal worker error', err);
      process.exit(1);
    });
  } catch (e) {
    console.error('Worker failed to start', e);
    process.exit(1);
  }
})();