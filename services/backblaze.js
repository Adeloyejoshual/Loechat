import axios from "axios";

let cachedAuth = null;
let authExpiresAt = 0;

export async function authorizeB2() {
  // Reuse token if still valid
  if (cachedAuth && Date.now() < authExpiresAt) {
    return cachedAuth;
  }

  const credentials = Buffer.from(
    `${process.env.B2_KEY_ID}:${process.env.B2_APPLICATION_KEY}`
  ).toString("base64");

  const res = await axios.get(
    "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
    {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    }
  );

  cachedAuth = res.data;
  authExpiresAt = Date.now() + 23 * 60 * 60 * 1000; // ~23h

  return cachedAuth;
}

export async function getUploadUrl() {
  const auth = await authorizeB2();

  const res = await axios.post(
    `${auth.apiUrl}/b2api/v2/b2_get_upload_url`,
    { bucketId: process.env.B2_BUCKET_ID },
    {
      headers: {
        Authorization: auth.authorizationToken,
      },
    }
  );

  return res.data;
}