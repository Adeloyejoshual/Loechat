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
  onReactionChange
}) {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  if (!message) return null;

  const isMine = message.senderId === myUid;

  const handleReply = () => { setReplyTo?.(message); };
  const handlePin = async () => {
    if (!message?.chatId || !message?.id) return;
    try { await updateDoc(doc(db,"chats",message.chatId,"messages",message.id), { pinned: true }); setPinnedMessage?.(message); toast.success("Pinned"); } 
    catch { toast.error("Failed"); }
  };
  const handleCopy = () => { try { navigator.clipboard.writeText(message.text || ""); toast.success("Copied"); } catch { toast.error("Failed"); } };
  const handleDelete = async () => {
    if (!message?.chatId || !message?.id) return;
    try {
      if (isMine) await updateDoc(doc(db,"chats",message.chatId,"messages",message.id), { deleted: true });
      else await updateDoc(doc(db,"chats",message.chatId,"messages",message.id), { deletedFor: arrayUnion(myUid) });
      toast.success("Deleted");
    } catch { toast.error("Failed"); }
  };

  const handleReact = async (emoji) => {
    if (!message?.chatId || !message?.id) return;
    const msgRef = doc(db, "chats", message.chatId, "messages", message.id);
    try {
      const snap = await getDoc(msgRef);
      const data = snap.data() || {};
      const users = data.reactions?.[emoji] || [];
      if (users.includes(myUid)) await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(myUid) });
      else await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(myUid) });
      const updatedSnap = await getDoc(msgRef);
      onReactionChange?.(updatedSnap.data()?.reactions || {});
    } catch { toast.error("Failed"); }
  };

  const emojis = ["👍","❤️","😂","😮","😢","🙏"];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 5000 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:12, padding:16, width:"90%", maxWidth:360, display:"flex", flexDirection:"column", gap:12 }}>
        <button onClick={handleReply} style={buttonStyle}>Reply</button>
        <button onClick={handlePin} style={buttonStyle}>Pin</button>
        {message.text && <button onClick={handleCopy} style={buttonStyle}>Copy</button>}
        <button onClick={handleDelete} style={{...buttonStyle,color:"red"}}>{isMine ? "Delete for everyone" : "Delete for me"}</button>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {emojis.map(e=>(
            <button key={e} onClick={()=>handleReact(e)} style={{ fontSize:20, padding:4, borderRadius:8, border:"1px solid #ddd", cursor:"pointer" }}>{e}</button>
          ))}
          <button onClick={()=>setEmojiPickerOpen(true)} style={{ fontSize:20, padding:4, borderRadius:8, border:"1px solid #ddd", cursor:"pointer" }}>+</button>
        </div>
        {emojiPickerOpen && <EmojiPicker open={true} onClose={()=>setEmojiPickerOpen(false)} onSelect={handleReact} />}
        <button onClick={onClose} style={{ ...buttonStyle, marginTop:8, color:"#555" }}>Cancel</button>
      </div>
    </div>
  );
}

const buttonStyle = { padding:"10px 12px", borderRadius:8, border:"none", background:"#f0f0f0", cursor:"pointer", textAlign:"left", fontSize:14, fontWeight:500 };