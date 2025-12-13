// src/pages/GlobalSearchPage.jsx
import React, { useEffect, useState } from "react";
import { collectionGroup, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";

export default function GlobalSearchPage() {
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!queryText.trim()) {
      setResults([]);
      return;
    }

    const search = async () => {
      // 🔹 Load recent messages across ALL chats
      const q = query(
        collectionGroup(db, "messages"),
        orderBy("createdAt", "desc"),
        limit(500) // adjust
      );

      const snap = await getDocs(q);

      const matches = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m =>
          m.text?.toLowerCase().includes(queryText.toLowerCase())
        );

      setResults(matches);
    };

    search();
  }, [queryText]);

  const openMessage = (msg) => {
    navigate(`/chat/${msg.chatId}`, {
      state: { scrollTo: msg.id }
    });
  };

  return (
    <div style={{ padding: 16 }}>
      <input
        placeholder="Search messages"
        value={queryText}
        onChange={(e) => setQueryText(e.target.value)}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 10,
          marginBottom: 12,
        }}
      />

      {results.map((m) => (
        <div
          key={m.id}
          onClick={() => openMessage(m)}
          style={{
            padding: 12,
            borderBottom: "1px solid #ddd",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 13, color: "#555" }}>
            Chat: {m.chatId}
          </div>
          <div style={{ fontWeight: 600 }}>
            {m.text}
          </div>
        </div>
      ))}
    </div>
  );
}