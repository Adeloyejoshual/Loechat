// src/components/UserDetailModal.jsx
import React, { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs, collectionGroup, orderBy, limit } from "firebase/firestore";
import { db } from "../firebaseConfig";

export default function UserDetailModal({ userId, onClose, isDark }) {
  const [user, setUser] = useState(null);
  const [userReports, setUserReports] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        // user profile
        const userSnap = await getDoc(doc(db, "users", userId));
        if (mounted) setUser(userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null);

        // previous reports where reportedId == userId OR reporterId == userId
        const rptQ = query(collection(db, "reports"), where("reportedId", "==", userId));
        const rptSnap = await getDocs(rptQ);
        if (mounted) setUserReports(rptSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // recent messages across all chats (collection group)
        // requires index on messages.senderId
        const msgQ = query(
          collectionGroup(db, "messages"),
          where("senderId", "==", userId),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        const msgSnap = await getDocs(msgQ);
        if (mounted) setRecentMessages(msgSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load user detail", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [userId]);

  if (!userId) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className={`w-full max-w-3xl mx-4 rounded-lg p-4 ${isDark ? "bg-gray-900 text-white" : "bg-white text-black"}`}>
        <div className="flex justify-between items-start mb-3">
          <h2 className="text-xl font-bold">User details</h2>
          <button onClick={onClose} className="text-sm px-2 py-1">Close</button>
        </div>

        {loading ? <p>Loading...</p> : (
          <>
            <div className="flex gap-4 items-center mb-4">
              <div style={{ width: 84, height: 84, borderRadius: 12, overflow: "hidden", background: "#eee" }}>
                {user?.photoURL ? <img src={user.photoURL} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (
                  <div style={{ padding: 16, fontSize: 18 }}>{user?.displayName?.slice(0,2) || "U"}</div>
                )}
              </div>
              <div>
                <div className="text-lg font-semibold">{user?.displayName || userId}</div>
                <div className="text-sm text-gray-400">{user?.email || "No email"}</div>
                <div className="text-sm mt-2">
                  {user?.blocked ? <span className="px-2 py-1 bg-red-600 text-white rounded">Blocked</span> : <span className="px-2 py-1 bg-green-600 text-white rounded">Active</span>}
                  {user?.suspendedUntil && <span className="ml-2 px-2 py-1 bg-yellow-500 text-black rounded">Suspended until {new Date(user.suspendedUntil.seconds * 1000).toLocaleString()}</span>}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="font-semibold">Previous Reports</h3>
              {userReports.length === 0 ? <p className="text-sm text-gray-500">No reports for this user</p> : (
                <ul className="list-inside">
                  {userReports.map((r) => (
                    <li key={r.id} className="py-2 border-b">
                      <div className="text-sm">{r.reason || "No reason"}</div>
                      <div className="text-xs text-gray-400">{r.status || "Pending"} • {r.reporterId} • {r.timestamp?.seconds ? new Date(r.timestamp.seconds * 1000).toLocaleString() : "No date"}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="font-semibold">Recent Messages (20)</h3>
              {recentMessages.length === 0 ? <p className="text-sm text-gray-500">No recent messages</p> : (
                <div className="max-h-64 overflow-auto">
                  {recentMessages.map((m) => (
                    <div key={m.id} className="py-2 border-b">
                      <div className="text-sm">{m.text || (m.mediaUrl ? `[${m.mediaType}]` : "—")}</div>
                      <div className="text-xs text-gray-400">{m.chatId ? `chat:${m.chatId}` : ""} • {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : (m.createdAt ? new Date(m.createdAt.seconds*1000).toLocaleString() : "")}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}