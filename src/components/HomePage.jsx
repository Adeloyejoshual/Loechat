// src/components/HomePage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { app, db } from "../firebaseConfig";
import { useAd } from "./AdGateway"; // Import Monetag Ad hook

export default function HomePage({ rewardCoins }) {
  const auth = getAuth(app);
  const navigate = useNavigate();
  const { showRewarded } = useAd(); // Hook to show ads

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  // 🔄 Redirect logged-in users automatically
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) navigate("/chat");
    });
    return unsub;
  }, [auth, navigate]);

  // 🔐 Email & Password auth (Login or Register)
  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isRegister) {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(user, { displayName: name });
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          name,
          email,
          createdAt: serverTimestamp(),
          balance: 0,
        });
        alert("✅ Account created successfully!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      // Show Vignette Banner on HomePage after login/register
      showRewarded(10287797, 15, () => {
        console.log("Vignette Banner finished");
      });

      navigate("/chat");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1>loechat 💬</h1>
        <p>
          {isRegister
            ? "Create your account to start chatting instantly"
            : "Welcome back! Login to continue chatting"}
        </p>

        {/* Show Monetag ad directly if you want inline banner on HomePage */}
        <div
          id="monetag-ad-homepage"
          data-zone="10287797" // Vignette Banner Zone ID
          style={{
            width: "100%",
            height: 100,
            margin: "20px 0",
            borderRadius: 12,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: 18,
            fontWeight: "bold",
            color: "#fff",
          }}
        >
          Loading Ad...
        </div>

        <form onSubmit={handleAuth} style={styles.form}>
          {isRegister && (
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={styles.input}
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
          />
          <button type="submit" style={styles.button}>
            {isRegister ? "Register" : "Login"}
          </button>
        </form>

        <p style={styles.toggle} onClick={() => setIsRegister(!isRegister)}>
          {isRegister
            ? "Already have an account? Login"
            : "Don’t have an account? Register"}
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #007bff 0%, #00c6ff 100%)",
    fontFamily: "'Poppins', sans-serif",
  },
  card: {
    background: "rgba(255,255,255,0.15)",
    backdropFilter: "blur(10px)",
    padding: "40px",
    borderRadius: "16px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
    width: "90%",
    maxWidth: "400px",
    color: "#fff",
    textAlign: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "20px",
  },
  input: {
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    outline: "none",
    fontSize: "15px",
  },
  button: {
    background: "#fff",
    color: "#007bff",
    fontWeight: "600",
    border: "none",
    borderRadius: "8px",
    padding: "12px",
    cursor: "pointer",
    transition: "0.3s",
  },
  toggle: {
    cursor: "pointer",
    textDecoration: "underline",
    fontSize: "14px",
    marginTop: "16px",
  },
};