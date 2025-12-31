import express from "express";
import multer from "multer";
import axios from "axios";
import crypto from "crypto";
import { getUploadUrl } from "../services/backblaze.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file provided" });
    }

    const { uploadUrl, authorizationToken } = await getUploadUrl();

    const fileName = `${Date.now()}-${crypto.randomUUID()}-${req.file.originalname}`;

    const response = await axios.post(uploadUrl, req.file.buffer, {
      headers: {
        Authorization: authorizationToken,
        "X-Bz-File-Name": encodeURIComponent(fileName),
        "Content-Type": req.file.mimetype,
        "X-Bz-Content-Sha1": "do_not_verify",
      },
      maxBodyLength: Infinity,
    });

    const fileUrl = `https://f005.backblazeb2.com/file/${process.env.B2_BUCKET_NAME}/${fileName}`;

    res.json({
      success: true,
      fileName,
      fileUrl,
      data: response.data,
    });
  } catch (err) {
    console.error("B2 Upload Error:", err.response?.data || err.message);
    res.status(500).json({ message: "Upload failed" });
  }
});

export default router;