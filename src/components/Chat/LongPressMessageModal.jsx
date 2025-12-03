import React, { useState, useRef, useEffect } from "react";  
import EmojiPicker from "./EmojiPicker";  
import { toast } from "react-toastify";

export default function LongPressMessageModal({  
  onClose,  
  onReaction,  
  onReply,  
  onCopy,  
  onPin,  
  onDelete,  
  quickReactions = ["😜", "💗", "😎", "😍", "☻️", "💖"],  
  isDark = false,  
  messageSenderName = "you",  
}) {  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);  
  const [confirmDelete, setConfirmDelete] = useState(false);  
  const modalRef = useRef(null);  

  // Close modal on outside click  
  useEffect(() => {  
    const handleClickOutside = (e) => {  
      if (modalRef.current && !modalRef.current.contains(e.target)) {  
        onClose();  
      }  
    };  
    document.addEventListener("mousedown", handleClickOutside);  
    return () => document.removeEventListener("mousedown", handleClickOutside);  
  }, [onClose]);  

  const buttonStyle = {  
    padding: 10,  
    cursor: "pointer",  
    border: "none",  
    background: "transparent",  
    fontSize: 14,  
    textAlign: "left",  
    borderRadius: 8,  
    width: "100%",  
  };  

  const actionButtonStyle = {  
    ...buttonStyle,  
    background: isDark ? "#2a2a2a" : "#f2f2f2",  
    color: isDark ? "#fff" : "#000",  
    display: "flex",  
    alignItems: "center",  
    gap: 8,  
  };  

  const handlePin = () => {  
    onPin();  
    toast.success("Message pinned/unpinned");  
    onClose();  
  };  

  const handleCopy = () => {  
    onCopy();  
    toast.success("Message copied");  
    onClose();  
  };  

  return (  
    <div  
      style={{  
        position: "fixed",  
        bottom: 80,  
        left: 0,  
        right: 0,  
        display: "flex",  
        justifyContent: "center",  
        zIndex: 3000,  
        padding: "0 12px",  
      }}  
    >  
      <div  
        ref={modalRef}  
        style={{  
          background: isDark ? "#1b1b1b" : "#fff",  
          borderRadius: 16,  
          boxShadow: "0 6px 22px rgba(0,0,0,0.25)",  
          width: "100%",  
          maxWidth: 360,  
          padding: 12,  
          animation: "slideFadeIn 150ms ease-out",  
        }}  
      >  
        {!confirmDelete ? (  
          <>  
            {/* Quick Reactions */}  
            <div  
              style={{  
                display: "flex",  
                gap: 8,  
                marginBottom: 12,  
                overflowX: "auto",  
              }}  
            >  
              {quickReactions.map((emoji) => (  
                <button  
                  key={emoji}  
                  onClick={() => { onReaction(emoji); onClose(); }}  
                  style={{ fontSize: 22, background: "transparent", border: "none", cursor: "pointer" }}  
                >  
                  {emoji}  
                </button>  
              ))}  
              <button  
                onClick={() => setShowEmojiPicker((v) => !v)}  
                style={{ fontSize: 22, background: "transparent", border: "none", cursor: "pointer" }}  
              >  
                ➕  
              </button>  
            </div>  

            {/* Emoji Picker */}  
            {showEmojiPicker && (  
              <EmojiPicker  
                onSelect={(emoji) => { onReaction(emoji); onClose(); }}  
                onClose={() => setShowEmojiPicker(false)}  
              />  
            )}  

            {/* Action Buttons */}  
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>  
              <button onClick={onReply} style={actionButtonStyle}>↩️ Reply</button>  
              <button onClick={handleCopy} style={actionButtonStyle}>📋 Copy</button>  
              <button onClick={handlePin} style={actionButtonStyle}>📌 Pin</button>  
              <button  
                onClick={() => setConfirmDelete(true)}  
                style={{ ...actionButtonStyle, color: "red" }}  
              >  
                🗑️ Delete  
              </button>  
              <button onClick={onClose} style={actionButtonStyle}>Close</button>  
            </div>  
          </>  
        ) : (  
          // Delete Confirmation  
          <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "center" }}>  
            <div style={{ fontSize: 14 }}>Are you sure you want to delete this message?</div>  
            <div style={{ fontSize: 12, color: "#888" }}>Delete for {messageSenderName}</div>  
            <div style={{ display: "flex", justifyContent: "space-around", marginTop: 8 }}>  
              <button  
                onClick={() => setConfirmDelete(false)}  
                style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", cursor: "pointer", flex: 1, marginRight: 4 }}  
              >  
                Cancel  
              </button>  
              <button  
                onClick={() => { onDelete(); onClose(); }}  
                style={{ padding: 8, borderRadius: 8, backgroundColor: "red", color: "#fff", cursor: "pointer", flex: 1, marginLeft: 4 }}  
              >  
                Delete  
              </button>  
            </div>  
          </div>  
        )}  
      </div>  

      {/* Animation */}  
      <style>  
        {`  
          @keyframes slideFadeIn {  
            0% { opacity: 0; transform: translateY(20px); }  
            100% { opacity: 1; transform: translateY(0); }  
          }  
        `}  
      </style>  
    </div>  
  );  
}