import React from "react";
import { auth, db } from "../../firebaseConfig";
import { deleteUser } from "firebase/auth";
import { deleteDoc, doc } from "firebase/firestore";

const AccountActionsSettings = ({ userId }) => {
  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to delete your account? This cannot be undone!")) return;
    try {
      await deleteDoc(doc(db, "users", userId));
      await deleteUser(auth.currentUser);
      alert("Account deleted successfully!");
      window.location.href = "/signup";
    } catch (err) {
      console.error(err);
      alert("Error deleting account. Please re-login and try again.");
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Account Actions Settings</h2>
      <button
        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
        onClick={handleDeleteAccount}
      >
        Delete Account
      </button>
    </div>
  );
};

export default AccountActionsSettings;