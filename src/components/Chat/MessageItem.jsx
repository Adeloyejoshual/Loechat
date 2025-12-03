import React, { useState, useRef, useContext, useEffect } from "react";  
import { doc, updateDoc, onSnapshot } from "firebase/firestore";  
import { db } from "../../firebaseConfig";  
import { ThemeContext } from "../../context/ThemeContext";  
import LongPressMessageModal from "./LongPressMessageModal";  
import { toast } from "react-toastify";

const COLORS = {  
  primary: "#34B7F1",  
  lightCard: "#fff",  
  darkCard: "#1b1b1b",  
  darkText: "#fff",  
  mutedText: "#777",  
  reactionBg: "rgba(0,0,0,0.7)",  
};  

const READ_MORE_LIMIT = 150;  

export default function MessageItem({  
  message,  
  myUid,  
  isDark,  
  chatId,  
  setReplyTo,  
  pinnedMessage,  
  setPinnedMessage,  
  onReplyClick,  
  friendId,  
  messages = [],  
  onOpenMediaViewer,  
}) {  
  const isMine = message.senderId === myUid;  
  const { theme } = useContext(ThemeContext);  

  const containerRef = useRef(null);  
  const textRef = useRef(null);  
  const lastTap = useRef(0);  
  const startX = useRef(0);  

  const [showModal, setShowModal] = useState(false);  
  const [reactedEmoji, setReactedEmoji] = useState(message.reactions?.[myUid] || "");  
  const [deleted, setDeleted] = useState(false);  
  const [fadeOut, setFadeOut] = useState(false);  
  const [translateX, setTranslateX] = useState(0);  
  const [status, setStatus] = useState(message.status || "Sent");  
  const [showFullText, setShowFullText] = useState(false);  
  const [textHeight, setTextHeight] = useState("auto");  
  const [fadeIn, setFadeIn] = useState(false);  
  const [reactionBubbles, setReactionBubbles] = useState([]);  

  useEffect(() => {  
    setFadeIn(true);  
    const timer = setTimeout(() => setFadeIn(false), 500);  
    return () => clearTimeout(timer);  
  }, []);  

  useEffect(() => {  
    if (!friendId) return;  
    const unsub = onSnapshot(doc(db, "users", friendId), (snap) => {  
      if (!snap.exists()) return;  
      const data = snap.data();  
      if (data.isOnline && isMine && status !== "sent") setStatus("Delivered");  
      if (message.seenBy?.includes(friendId)) setStatus("Seen");  
    });  
    return () => unsub();  
  }, [friendId, message, isMine, status]);  

  const togglePin = async () => {  
    const chatRef = doc(db, "chats", chatId);  
    const newPin = pinnedMessage?.id !== message.id;  
    await updateDoc(chatRef, { pinnedMessageId: newPin ? message.id : null });  
    setPinnedMessage(newPin ? message : null);  
    toast.success(newPin ? "Message pinned" : "Message unpinned");  
  };  

  const deleteMessage = async () => {  
    if (!window.confirm(`Delete this message for ${isMine ? "everyone" : "them"}?`)) return;  

    setFadeOut(true);  
    setTimeout(async () => {  
      setDeleted(true);  
      await updateDoc(doc(db, "chats", chatId, "messages", message.id), { deleted: true });  
    }, 300);  
  };  

  const copyMessage = async () => {  
    await navigator.clipboard.writeText(message.text || message.mediaUrl || "");  
    toast.success("Message copied");  
  };  

  const applyReaction = async (emoji) => {  
    const msgRef = doc(db, "chats", chatId, "messages", message.id);  
    const newEmoji = reactedEmoji === emoji ? "" : emoji;  
    await updateDoc(msgRef, { [`reactions.${myUid}`]: newEmoji });  
    setReactedEmoji(newEmoji);  

    if (newEmoji) {  
      const bubbleId = Date.now();  
      setReactionBubbles((prev) => [...prev, { id: bubbleId, emoji: newEmoji }]);  
      setTimeout(() => setReactionBubbles((prev) => prev.filter((b) => b.id !== bubbleId)), 800);  
    }  
  };  

  const handleTap = () => {  
    const now = Date.now();  
    if (now - lastTap.current < 300) {  
      applyReaction("❤️");  
      lastTap.current = 0;  
    } else {  
      lastTap.current = now;  
    }  
  };  

  const handleTouchStart = (e) => (startX.current = e.touches[0].clientX);  
  const handleTouchMove = (e) => {  
    const deltaX = e.touches[0].clientX - startX.current;  
    setTranslateX(Math.min(Math.abs(deltaX), 100) * Math.sign(deltaX));  
  };  
  const handleTouchEnd = () => {  
    if (Math.abs(translateX) > 50) {  
      setReplyTo(message);  
    }  
    setTranslateX(0);  
  };  

  if (deleted) return null;  

  useEffect(() => {  
    if (textRef.current) {  
      setTextHeight(  
        showFullText  
          ? `${textRef.current.scrollHeight}px`  
          : `${Math.min(textRef.current.scrollHeight, 80)}px`  
      );  
    }  
  }, [showFullText]);  

  const renderMessageText = () => {  
    if (!message.text) return null;  
    if (message.text.length <= READ_MORE_LIMIT) return <div>{message.text}</div>;  

    return (  
      <div ref={textRef} style={{ maxHeight: textHeight, overflow: "hidden", transition: "max-height 0.3s ease" }}>  
        {message.text.slice(0, READ_MORE_LIMIT)}  
        {!showFullText && (  
          <span style={{ color: COLORS.primary, cursor: "pointer", fontWeight: 500, marginLeft: 4 }} onClick={() => setShowFullText(true)}>Read More</span>  
        )}  
        {showFullText && message.text.slice(READ_MORE_LIMIT)}  
      </div>  
    );  
  };  

  const handleMediaClick = () => {  
    if (onOpenMediaViewer && message.mediaUrl) {  
      onOpenMediaViewer(message.mediaUrl);  
    }  
  };  

  return (  
    <>  
      <div  
        ref={containerRef}  
        id={message.id}  
        className={`message-item ${isMine ? "mine" : "other"}`}  
        style={{  
          display: "flex",  
          flexDirection: "column",  
          alignItems: isMine ? "flex-end" : "flex-start",  
          marginBottom: 8,  
          position: "relative",  
          transform: `translateX(${translateX}px) ${fadeOut ? `translateX(${isMine ? 100 : -100}px)` : ""}`,  
          transition: "transform 0.3s ease, opacity 0.3s ease",  
          opacity: fadeOut ? 0 : fadeIn ? 0 : 1,  
        }}  
        onClick={handleTap}  
        onContextMenu={(e) => { e.preventDefault(); setShowModal(true); }}  
        onTouchStart={handleTouchStart}  
        onTouchMove={handleTouchMove}  
        onTouchEnd={handleTouchEnd}  
      >  
        <div className="message-bubble" style={{ maxWidth: "75%", padding: 10, borderRadius: 18, background: isMine ? COLORS.primary : isDark ? COLORS.darkCard : COLORS.lightCard, color: isMine ? "#fff" : isDark ? COLORS.darkText : "#000", wordBreak: "break-word", display: "inline-block", position: "relative", boxShadow: "0 1px 3px rgba(0,0,0,0.15)", transition: "background 0.2s ease" }}>  

          {/* Tail */}  
          <div style={{ position: "absolute", bottom: 0, width: 0, height: 0, borderStyle: "solid", borderWidth: "6px 6px 0 0", borderColor: isMine ? `${COLORS.primary} transparent transparent transparent` : `${isDark ? COLORS.darkCard : COLORS.lightCard} transparent transparent transparent`, right: isMine ? -6 : "auto", left: isMine ? "auto" : -6 }} />  

          {/* Reply Preview */}  
          {message.replyTo && (  
            <div onClick={() => onReplyClick?.(message.replyTo?.id)} style={{ fontSize: 12, opacity: 0.7, borderLeft: `2px solid ${COLORS.mutedText}`, paddingLeft: 6, marginBottom: 4, cursor: "pointer" }}>↪ {message.replyTo?.text?.slice(0, 50)}</div>  
          )}  

          {/* Media + Text */}  
          {message.mediaUrl ? (  
            <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>  
              {message.mediaType === "image" && <img src={message.mediaUrl} alt="media" style={{ maxWidth: "100%", borderRadius: 12, cursor: "pointer" }} onClick={handleMediaClick} />}  
              {message.mediaType === "video" && <video src={message.mediaUrl} controls style={{ maxWidth: "100%", borderRadius: 12, cursor: "pointer" }} onClick={handleMediaClick} />}  
              {message.text && <div style={{ marginTop: 4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{message.text}</div>}  
            </div>  
          ) : renderMessageText()}  

          {/* Reactions */}  
          <div style={{ position: "relative", marginTop: 4 }}>  
            {message.reactions && Object.values(message.reactions).filter(Boolean).map((emoji, i) => (  
              <span key={i} style={{ background: COLORS.reactionBg, color: "#fff", padding: "0 6px", borderRadius: 12, fontSize: 12, marginRight: 4 }}>{emoji}</span>  
            ))}  
            {reactionBubbles.map((b) => (  
              <div key={b.id} style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", animation: "popUp 0.8s forwards", pointerEvents: "none", fontSize: 18 }}>{b.emoji}</div>  
            ))}  
          </div>  

          {/* Timestamp + Status */}  
          {message.createdAt && (  
            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: isMine ? "right" : "left", display: "flex", alignItems: "center", gap: 4 }}>  
              {new Date(message.createdAt.toDate ? message.createdAt.toDate() : message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}  
              {isMine && status && <>• {status === "sending" ? "Sending..." : status}</>}  
            </div>  
          )}  
        </div>  
      </div>  

      {/* Long Press Modal */}  
      {showModal && (  
        <LongPressMessageModal  
          onClose={() => setShowModal(false)}  
          onReaction={applyReaction}  
          onReply={() => setReplyTo(message)}  
          onCopy={copyMessage}  
          onPin={togglePin}  
          onDelete={deleteMessage}  
          messageSenderName={isMine ? "you" : "them"}  
          isDark={isDark}  
        />  
      )}  

      <style>{`  
        @keyframes popUp {  
          0% { transform: translate(-50%, 0) scale(1); opacity: 1; }  
          50% { transform: translate(-50%, -20px) scale(1.3); opacity: 1; }  
          100% { transform: translate(-50%, -40px) scale(1); opacity: 0; }  
        }  
      `}</style>  
    </>  
  );  
}