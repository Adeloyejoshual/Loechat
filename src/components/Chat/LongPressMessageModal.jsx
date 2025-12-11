// src/components/Chat/LongPressMessageModal.jsx
import React from "react";
import { doc, updateDoc, arrayUnion, arrayRemove, deleteDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { toast } from "react-toastify";

export default function LongPressMessageModal({ 
  message, 
  myUid, 
  onClose, 
  setReplyTo, 
  setPinnedMessage, 
  chatContainerRef 
}) {
  if (!message) return null;

  const isMine = message.senderId === myUid;

  const handleReply = () => {
    setReplyTo?.(message);
    onClose?.();
  };

  const handlePin = async () => {
    if (!message?.chatId || !message?.id) return;
    const msgRef = doc(db, "chats", message.chatId, "messages", message.id);
    try {
      await updateDoc(msgRef, { pinned: true });
      setPinnedMessage?.(message);
      toast.success("Message pinned");
    } catch {
      toast.error("Failed to pin");
    }
    onClose?.();
  };

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(message.text || "");
      toast.success("Copied");
    } catch {
      toast.error("Failed to copy");
    }
    onClose?.();
  };

  const handleDelete = async () => {
    if (!message?.chatId || !message?.id) return;
    const msgRef = doc(db, "chats", message.chatId, "messages", message.id);
    try {
      if (isMine) {
        await updateDoc(msgRef, { deleted: true });
      } else {
        await updateDoc(msgRef, { deletedFor: arrayUnion(myUid) });
      }
      toast.success("Message deleted");
    } catch {
      toast.error("Failed to delete");
    }
    onClose?.();
  };

  const handleReact = async (emoji) => {
    if (!message?.chatId || !message?.id) return;
    const msgRef = doc(db, "chats", message.chatId, "messages", message.id);
    try {
      const users = message.reactions?.[emoji] || [];
      if (users.includes(myUid)) {
        await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(myUid) });
      } else {
        await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(myUid) });
      }
    } catch {
      toast.error("Failed to react");
    }
  };

  // Example emoji reactions
  const emojis = ["👍","❤️","😂","😮","😢","🙏"];

  return (
    <div 
      onClick={onClose} 
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 5000
      }}
    >
      <div onClick={(e)=>e.stopPropagation()} style={{
        background: "#fff", borderRadius: 12, padding: 16, width: "90%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12
      }}>
        {/* Reply */}
        <button onClick={handleReply} style={buttonStyle}>Reply</button>

        {/* Pin */}
        <button onClick={handlePin} style={buttonStyle}>Pin</button>

        {/* Copy */}
        {message.text && <button onClick={handleCopy} style={buttonStyle}>Copy</button>}

        {/* Delete */}
        <button onClick={handleDelete} style={{...buttonStyle, color:"red"}}>{isMine ? "Delete for everyone" : "Delete for me"}</button>

        {/* Reactions */}
        <div style={{ display:"flex", gap:8, marginTop:4, flexWrap:"wrap" }}>
          {emojis.map((e)=>(
            <button key={e} onClick={()=>handleReact(e)} style={{ fontSize:20, padding:4, borderRadius:8, border:"1px solid #ddd", cursor:"pointer" }}>
              {e}
            </button>
          ))}
        </div>

        {/* Close */}
        <button onClick={onClose} style={{ ...buttonStyle, marginTop: 8, color: "#555" }}>Cancel</button>
      </div>
    </div>
  );
}

const buttonStyle = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "none",
  background: "#f0f0f0",
  cursor: "pointer",
  textAlign: "left",
  fontSize: 14,
  fontWeight: 500
};