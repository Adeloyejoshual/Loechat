import React from "react";
import { db } from "../../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

const DataAndStorageSettings = ({ userId }) => {
  const downloadData = async () => {
    const docSnap = await getDoc(doc(db, "users", userId));
    const data = docSnap.data();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user_data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Data & Storage Settings</h2>
      <div className="flex flex-col space-y-3">
        <button
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          onClick={() => { localStorage.clear(); alert("Cache cleared!"); }}
        >
          Clear Cache
        </button>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          onClick={downloadData}
        >
          Download Data
        </button>
      </div>
    </div>
  );
};

export default DataAndStorageSettings;