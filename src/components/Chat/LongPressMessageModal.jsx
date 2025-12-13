// src/components/Chat/LongPressMessageModal.jsx
import React, { useState } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { toast } from "react-toastify";
import EmojiPicker from "./EmojiPicker";

export default function LongPressMessageModal({
  message,
  myUid,
  onClose,
  setReplyTo,
  setPinnedMessage,
  onReactionChange,
}) {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  if (!message) return null;
  const isMine = message.senderId === myUid;

  const handleReply = () => {
    setReplyTo?.(message);
    onClose?.();
  };

  const handlePin = async () => {
    if (!message?.chatId || !message?.id) return;
    try {
      await updateDoc(doc(db, "chats", message.chatId), { pinnedMessageId: message.id });
      setPinnedMessage?.(message);
      toast.success("Pinned");
    } catch {
      toast.error("Failed to pin");
    }
    onClose?.();
  };

  const handleCopy = () => {
    try {
      const txt = message.text ?? message.message ?? message.body ?? "";
      navigator.clipboard.writeText(txt);
      toast.success("Copied");
    } catch {
      toast.error("Failed to copy");
    }
    onClose?.();
  };

  const handleDelete = async () => {
    if (!message?.chatId || !message?.id) return;
    try {
      if (isMine) {
        await updateDoc(doc(db, "chats", message.chatId, "messages", message.id), { deleted: true });
      } else {
        await updateDoc(doc(db, "chats", message.chatId, "messages", message.id), { deletedFor: arrayUnion(myUid) });
      }
      toast.success("Deleted");
    } catch {
      toast.error("Failed");
    }
    onClose?.();
  };

  const handleReact = async (emoji) => {
    if (!message?.chatId || !message?.id) return;
    const msgRef = doc(db, "chats", message.chatId, "messages", message.id);
    try {
      const snap = await getDoc(msgRef);
      const data = snap.data() || {};
      const users = data.reactions?.[emoji] || [];
      if (users.includes(myUid)) {
        await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(myUid) });
      } else {
        await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(myUid) });
      }
      const updated = (await getDoc(msgRef)).data()?.reactions || {};
      onReactionChange?.(updated);
    } catch {
      toast.error("Failed to react");
    }
    onClose?.();
  };

  const emojis = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 5000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 16, width: "90%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={handleReply} style={buttonStyle}>Reply</button>
        <button onClick={handlePin} style={buttonStyle}>Pin</button>
        {message.text && <button onClick={handleCopy} style={buttonStyle}>Copy</button>}
        <button onClick={handleDelete} style={{ ...buttonStyle, color: "red" }}>{isMine ? "Delete for everyone" : "Delete for me"}</button>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {emojis.map((e) => (
            <button key={e} onClick={() => handleReact(e)} style={{ fontSize: 20, padding: 6, borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}>{e}</button>
          ))}
          <button onClick={() => setEmojiPickerOpen(true)} style={{ fontSize: 18, padding: 6, borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}>+</button>
        </div>

        {emojiPickerOpen && <EmojiPicker open={true} onClose={() => setEmojiPickerOpen(false)} onSelect={(e) => handleReact(e)} />}

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
  fontWeight: 500,
};