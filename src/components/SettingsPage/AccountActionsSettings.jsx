import React, { useState } from "react";
import { auth, db } from "../../firebaseConfig";
import { doc, deleteDoc } from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { usePopup } from "../../context/PopupContext";

export default function AccountActionsSettings({ userId }) {
  const { showPopup } = usePopup();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleDeleteAccount = async () => {
    if (loading) return;

    const confirmed = window.confirm(
      "⚠️ This will permanently delete your account and data. Continue?"
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No authenticated user");

      // Delete Firestore user doc
      if (userId) {
        await deleteDoc(doc(db, "users", userId));
      }

      // Delete auth user
      await deleteUser(user);

      showPopup("✅ Account deleted successfully");
      navigate("/");
    } catch (err) {
      console.error(err);
      showPopup("❌ Failed to delete account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        background: "#ffebee",
        border: "1px solid #ffcdd2",
      }}
    >
      <h3 style={{ marginBottom: 8 }}>⚠️ Account Actions</h3>

      <button
        onClick={handleDeleteAccount}
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 8,
          border: "none",
          background: "#d32f2f",
          color: "#fff",
          fontWeight: "bold",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Deleting..." : "Delete Account"}
      </button>
    </div>
  );
}