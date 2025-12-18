import React, { useContext } from "react";
import { auth, db } from "../../firebaseConfig";
import { deleteUser } from "firebase/auth";
import { deleteDoc, doc } from "firebase/firestore";
import { ThemeContext } from "../../context/ThemeContext";
import { usePopup } from "../../context/PopupContext";

const AccountActionsSettings = ({ userId }) => {
  const { theme } = useContext(ThemeContext);
  const { showPopup } = usePopup();
  const isDark = theme === "dark";

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to delete your account? This cannot be undone!")) return;

    try {
      // Delete user data from Firestore
      await deleteDoc(doc(db, "users", userId));

      // Delete Firebase auth user
      await deleteUser(auth.currentUser);

      showPopup("✅ Account deleted successfully!");
      // Redirect after a short delay
      setTimeout(() => window.location.href = "/signup", 1500);
    } catch (err) {
      console.error(err);
      showPopup("❌ Error deleting account. Please re-login and try again.");
    }
  };

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        background: isDark ? "#2b2b2b" : "#fff",
        marginBottom: 16,
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
      }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: isDark ? "#fff" : "#333" }}>
        Account Actions
      </h2>
      <button
        onClick={handleDeleteAccount}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 8,
          border: "none",
          background: "#ff4d4f",
          color: "#fff",
          fontWeight: "bold",
          cursor: "pointer",
          transition: "background 0.2s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "#e04344"}
        onMouseLeave={e => e.currentTarget.style.background = "#ff4d4f"}
      >
        Delete Account
      </button>
    </div>
  );
};

export default AccountActionsSettings;