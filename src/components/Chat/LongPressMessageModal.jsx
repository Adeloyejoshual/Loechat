
import React, { useState, useEffect, useRef } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove, deleteDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { toast } from "react-toastify";
import EmojiPicker from "./EmojiPicker";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

export default function LongPressMessageModal({
  message,
  myUid,
  isDark = false,
  onClose,
  setReplyTo,
  setPinnedMessage,
  localReactions = {},
}) {
  const [reactions, setReactions] = useState(localReactions);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => setReactions(localReactions), [localReactions]);

  // Close modal on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [onClose]);

  // ---------- Real-time reactions ----------
  const toggleReaction = async (emoji) => {
    const msgRef = doc(db, "chats", message.chatId, "messages", message.id);

    try {
      const alreadyReacted = message.reactions?.[emoji]?.includes(myUid);
      await updateDoc(msgRef, {
        [`reactions.${emoji}`]: alreadyReacted ? arrayRemove(myUid) : arrayUnion(myUid),
      });
    } catch {
      toast.error("Failed to update reaction");
    }
    onClose?.();
  };

  // ---------- Copy ----------
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text || "");
      toast.success("Message copied!");
      onClose?.();
    } catch {
      toast.error("Failed to copy message");
    }
  };

  // ---------- Pin ----------
  const handlePin = async () => {
    try {
      // Unpin any existing pinned messages
      const chatRef = doc(db, "chats", message.chatId);
      if (message.pinned) return; // already pinned
      await updateDoc(chatRef, { pinnedMessageId: message.id });

      setPinnedMessage(message); // update UI
      onClose?.();
    } catch {
      toast.error("Failed to pin message");
    }
  };

  // ---------- Delete ----------
  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, "chats", message.chatId, "messages", message.id));
      toast.success("Message deleted");
      onClose?.();
    } catch {
      toast.error("Failed to delete message");
    }
  };

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(4px)",
          zIndex: 9999,
        }}
        onClick={onClose}
      />
      <div
        ref={modalRef}
        style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          width: "90%",
          maxWidth: 360,
          background: isDark ? "#1c1c1c" : "#fff",
          borderRadius: 16,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
          zIndex: 10000,
        }}
      >
        <div>{message.text || "Media message"}</div>

        <button onClick={() => { setReplyTo(message); onClose(); }}>Reply</button>
        <button onClick={handlePin}>Pin</button>
        <button onClick={handleCopy}>Copy</button>
        <button onClick={handleDelete} style={{ color: "red" }}>Delete</button>

        <div style={{ display: "flex", gap: 8 }}>
          {QUICK_EMOJIS.map((e) => (
            <button key={e} onClick={() => toggleReaction(e)}>
              {e} {message.reactions?.[e]?.length || ""}
            </button>
          ))}
          <button onClick={() => setShowEmojiPicker(true)}>+</button>
        </div>

        {showEmojiPicker && (
          <EmojiPicker
            open
            isDark={isDark}
            onClose={() => setShowEmojiPicker(false)}
            onSelect={(e) => toggleReaction(e)}
          />
        )}
      </div>
    </>
  );
}