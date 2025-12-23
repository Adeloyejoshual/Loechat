import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "../../firebaseConfig";
import { doc, deleteDoc, collection, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteUser, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { usePopup } from "../../context/PopupContext";
import { useTheme } from "../../hooks/useTheme";
import { motion, AnimatePresence } from "framer-motion";
import { v4 as uuidv4 } from "uuid";

export default function AccountSettingsPage({ userId }) {
  const { showPopup } = usePopup();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const user = auth.currentUser;
  const sessionId = uuidv4();

  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);

  const containerRef = useRef(null);
  const startX = useRef(0);
  const endX = useRef(0);
  const [isExiting, setIsExiting] = useState(false);

  // =================== SWIPE TO GO BACK ===================
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      startX.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e) => {
      endX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
      const deltaX = endX.current - startX.current;
      if (deltaX > 100) {
        // Trigger exit animation
        setIsExiting(true);
        setTimeout(() => navigate("/settings"), 250);
      }
    };

    container.addEventListener("touchstart", handleTouchStart);
    container.addEventListener("touchmove", handleTouchMove);
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [navigate]);

  // =================== SESSION TRACKING ===================
  useEffect(() => {
    if (!user) return;

    const sessionRef = doc(db, `users/${user.uid}/sessions/${sessionId}`);
    setDoc(sessionRef, {
      deviceName: navigator.userAgent,
      lastActive: serverTimestamp(),
      sessionId,
    });

    const unsub = onSnapshot(collection(db, `users/${user.uid}/sessions`), (snap) => {
      const data = [];
      snap.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setSessions(data);
    });

    const handleBeforeUnload = async () => {
      await deleteDoc(sessionRef);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      unsub();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      deleteDoc(sessionRef);
    };
  }, [user]);

  // =================== LOGOUT OTHER SESSIONS ===================
  const handleLogoutSession = async (id) => {
    if (id === sessionId) return showPopup("❌ Cannot log out current session");
    try {
      await deleteDoc(doc(db, `users/${user.uid}/sessions/${id}`));
      showPopup("✅ Session logged out");
    } catch (err) {
      console.error(err);
      showPopup("❌ Failed to log out session");
    }
  };

  // =================== PASSWORD & ACCOUNT ===================
  const handleChangePassword = async () => {
    if (!user || !password || !newPassword) return showPopup("❌ Fill all password fields");
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      showPopup("✅ Password updated");
      setPassword("");
      setNewPassword("");
    } catch (err) {
      console.error(err);
      showPopup("❌ Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return showPopup("❌ No authenticated user");
    if (!password) return showPopup("❌ Enter your password");
    if (!confirmed) return showPopup("❌ Confirm deletion");

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);

      if (userId) await deleteDoc(doc(db, "users", userId));
      await deleteUser(user);
      showPopup("✅ Account deleted permanently");
      navigate("/");
    } catch (err) {
      console.error(err);
      showPopup("❌ Password incorrect or deletion failed");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <p>Loading...</p>;

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          ref={containerRef}
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            minHeight: "100vh",
            padding: 20,
            background: isDark ? "#121212" : "#f8f8f8",
            color: isDark ? "#fff" : "#000",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Back Arrow */}
          <div
            onClick={() => {
              setIsExiting(true);
              setTimeout(() => navigate("/settings"), 250);
            }}
            style={{ alignSelf: "flex-start", cursor: "pointer", marginBottom: 24, fontSize: 20, fontWeight: "bold" }}
          >
            ← Back to Settings
          </div>

          {/* PASSWORD PANEL */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={panelStyle(isDark)}
          >
            <h2>🔒 Password & Security</h2>
            <input type="password" placeholder="Current password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle(isDark)} />
            <input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle(isDark)} />
            <button onClick={handleChangePassword} disabled={loading} style={actionBtn(isDark, "#00e676")}>
              {loading ? "Updating..." : "Update Password"}
            </button>
          </motion.div>

          {/* SESSIONS PANEL */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.35 }}
            style={panelStyle(isDark)}
          >
            <h2>💻 Active Sessions</h2>
            {sessions.map((s) => (
              <div key={s.id} style={sessionItem(isDark)}>
                <span>{s.deviceName}</span>
                <button onClick={() => handleLogoutSession(s.id)} style={sessionBtn}>{s.id === sessionId ? "Current" : "Log out"}</button>
              </div>
            ))}
          </motion.div>

          {/* DANGER ZONE */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
            style={{ ...panelStyle(isDark), border: "2px solid #d32f2f" }}
          >
            <h2 style={{ color: "#d32f2f" }}>⚠️ Danger Zone</h2>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              I understand this action is permanent
            </label>
            <input type="password" placeholder="Enter password to confirm" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle(isDark)} />
            <button onClick={handleDeleteAccount} disabled={loading} style={actionBtn(isDark, "#d32f2f")}>
              {loading ? "Deleting..." : "Delete My Account"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ================= STYLES =================
const inputStyle = (isDark) => ({
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "1px solid #ccc",
  marginBottom: 16,
  background: isDark ? "#2a2a2a" : "#fff",
  color: isDark ? "#fff" : "#000",
});

const actionBtn = (isDark, bg) => ({
  width: "100%",
  padding: 14,
  borderRadius: 10,
  border: "none",
  background: bg,
  color: "#fff",
  fontWeight: "bold",
  fontSize: 15,
  cursor: "pointer",
});

const panelStyle = (isDark) => ({
  width: "100%",
  maxWidth: 520,
  background: isDark ? "#1e1e1e" : "#fff",
  borderRadius: 14,
  padding: 24,
  boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
  marginBottom: 24,
});

const sessionItem = (isDark) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 12,
  marginBottom: 12,
  borderRadius: 8,
  background: isDark ? "#2a2a2a" : "#f5f5f5",
});

const sessionBtn = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "none",
  background: "#d32f2f",
  color: "#fff",
  cursor: "pointer",
  fontSize: 12,
};