import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import admin from "firebase-admin";
import mongoose from "mongoose";
import fs from "fs";
import B2 from "backblaze-b2";
import multer from "multer";
import http from "http";
import { Server } from "socket.io";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------
// Firebase Admin
// -----------------------------
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
  console.log("🔥 Firebase Admin initialized");
}

// -----------------------------
// MongoDB
// -----------------------------
mongoose.set("strictQuery", true);
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🟢 MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// -----------------------------
// Models (Wallet & Transaction)
// -----------------------------
const transactionSchema = new mongoose.Schema({
  uid: { type: String, required: true },
  type: { type: String, enum: ["credit", "debit", "checkin", "deposit", "withdraw"] },
  amount: Number,
  description: String,
  status: { type: String, default: "Success" },
  txnId: { type: String, unique: true },
  balanceAfter: Number,
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });
const Transaction = mongoose.model("Transaction", transactionSchema);

const walletSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  lastCheckIn: { type: String, default: null },
});
const Wallet = mongoose.model("Wallet", walletSchema);

const generateTxnId = () =>
  `txn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// -----------------------------
// Firebase Auth Middleware
// -----------------------------
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const raw = req.headers.authorization || "";
    const token = raw.startsWith("Bearer ") ? raw.split(" ")[1] : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const decoded = await admin.auth().verifyIdToken(token);
    req.authUID = decoded.uid;
    next();
  } catch (err) {
    console.error("❌ Firebase Auth Error:", err.message);
    res.status(401).json({ error: "Invalid token" });
  }
};

// -----------------------------
// Wallet & B2 routes (unchanged)
// -----------------------------
const b2 = new B2({ accountId: process.env.B2_KEY_ID, applicationKey: process.env.B2_APPLICATION_KEY });
await b2.authorize();
console.log("🔥 Backblaze B2 authorized");
const upload = multer({ storage: multer.memoryStorage() });

// Wallet & B2 endpoints here (same as your current server.js)...

// -----------------------------
// Serve Frontend
// -----------------------------
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist/index.html")));

// -----------------------------
// Socket.IO Signaling for WebRTC
// -----------------------------
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const rooms = {}; // roomName -> [socket.id]

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("join-room", ({ userId, room }) => {
    if (!rooms[room]) rooms[room] = [];
    rooms[room].forEach(id => io.to(id).emit("new-participant", { from: socket.id }));
    rooms[room].push(socket.id);
    socket.userId = userId;
    socket.room = room;
    console.log(`${userId} joined room ${room}`);
  });

  socket.on("offer", ({ to, offer }) => io.to(to).emit("offer", { from: socket.id, offer }));
  socket.on("answer", ({ to, answer }) => io.to(to).emit("answer", { from: socket.id, answer }));
  socket.on("ice-candidate", ({ to, candidate }) => io.to(to).emit("ice-candidate", { from: socket.id, candidate }));

  socket.on("disconnect", () => {
    if (socket.room) {
      rooms[socket.room] = rooms[socket.room].filter(id => id !== socket.id);
      console.log(`⚡ Socket ${socket.id} disconnected from room ${socket.room}`);
    }
  });
});

// -----------------------------
// Start Server
// -----------------------------
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));