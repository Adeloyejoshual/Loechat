// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useCallback, useMemo, useContext } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";
import LongPressMessageModal from "./Chat/LongPressMessageModal";
import EmojiPicker from "./Chat/EmojiPicker";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const FLASH_HIGHLIGHT_STYLE = `
.flash-highlight { animation: flash 1.2s ease; }
@keyframes flash {
  0% { background-color: rgba(255,255,0,0.4); }
  100% { background-color: transparent; }
}
`;

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const { theme, wallpaper } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);
  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid || currentUser?.uid;

  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const messageRefs = useRef({});
  const typingTimer = useRef(null);
  const initialScrollDone = useRef(false);

  const [chatInfo, setChatInfo] = useState({});
  const [friendInfo, setFriendInfo] = useState({});
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [longPressMessage, setLongPressMessage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // -------------------- CHAT & FRIEND INFO --------------------
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    const unsubList = [];

    const unsubChat = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(Boolean(data.blocked));
      setIsMuted(Boolean(data.mutedUntil && data.mutedUntil.toMillis() > Date.now()));

      const friendId = (data.participants || []).find((p) => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        const unsubFriend = onSnapshot(userRef, (s) => {
          if (s.exists()) setFriendInfo({ id: s.id, ...s.data() });
        });
        unsubList.push(unsubFriend);

        setFriendTyping(Boolean(data.typing?.[friendId]));
      }

      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        const unsubPinned = onSnapshot(pinnedRef, (s) => {
          if (s.exists()) setPinnedMessage({ id: s.id, ...s.data() });
        });
        unsubList.push(unsubPinned);
      } else setPinnedMessage(null);
    });

    unsubList.push(unsubChat);
    return () => unsubList.forEach((u) => u());
  }, [chatId, myUid]);

  // -------------------- MESSAGES SUB --------------------
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
      }));
      setMessages(docs);

      // mark delivered for current user
      docs
        .filter((m) => m.senderId !== myUid && !(m.deliveredTo || []).includes(myUid))
        .forEach((m) =>
          updateDoc(doc(db, "chats", chatId, "messages", m.id), { deliveredTo: arrayUnion(myUid) }).catch(() => {})
        );

      // auto scroll
      if (isAtBottom || !initialScrollDone.current) {
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "auto" }), 50);
        initialScrollDone.current = true;
      }
    });

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -------------------- MARK SEEN --------------------
  useEffect(() => {
    if (!chatId || !myUid || messages.length === 0) return;
    messages
      .filter((m) => m.senderId !== myUid && !(m.seenBy || []).includes(myUid))
      .forEach((m) =>
        updateDoc(doc(db, "chats", chatId, "messages", m.id), { seenBy: arrayUnion(myUid) }).catch(() => {})
      );
    updateDoc(doc(db, "chats", chatId), { [`lastSeen.${myUid}`]: serverTimestamp() }).catch(() => {});
  }, [messages, chatId, myUid]);

  // -------------------- SCROLL --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    let timeout;
    const onScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
      }, 50);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // -------------------- TYPING --------------------
  const setTypingFlag = useCallback(async (typing) => {
    if (!chatId || !myUid) return;
    try {
      await updateDoc(doc(db, "chats", chatId), { [`typing.${myUid}`]: typing ? serverTimestamp() : null });
    } catch {}
  }, [chatId, myUid]);

  const handleUserTyping = useCallback((isTyping) => {
    clearTimeout(typingTimer.current);
    if (isTyping) setTypingFlag(true);
    typingTimer.current = setTimeout(() => setTypingFlag(false), 1500);
  }, [setTypingFlag]);

  // -------------------- SEND MESSAGE --------------------
  const sendMessage = useCallback(async (textMsg = "") => {
    if (isBlocked) return toast.error("You cannot send messages");
    if (!textMsg) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const tempMessage = {
      id: tempId,
      senderId: myUid,
      text: textMsg.trim(),
      createdAt: new Date(),
      reactions: {},
      seenBy: [],
      deliveredTo: [],
      replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId } : null,
      status: "sending",
    };

    // Optimistic UI
    setMessages((prev) => [...prev, tempMessage]);
    endRef.current?.scrollIntoView({ behavior: "smooth" });

    try {
      const messagesCol = collection(db, "chats", chatId, "messages");
      const payload = { ...tempMessage, createdAt: serverTimestamp(), status: "sent" };
      const docRef = await addDoc(messagesCol, payload);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...payload, id: docRef.id, createdAt: new Date() } : m))
      );
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: textMsg,
        lastMessageSender: myUid,
        lastMessageAt: serverTimestamp(),
        lastMessageStatus: "delivered",
      });
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
      );
      toast.error("Failed to send message");
    } finally {
      setReplyTo(null);
      setText("");
    }
  }, [chatId, myUid, isBlocked, replyTo]);

  // -------------------- REACTIONS --------------------
  const handleReact = useCallback(async (messageId, emoji) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const hasReacted = m.reactions?.[emoji]?.includes(myUid);
        const newReactions = { ...m.reactions };
        if (!newReactions[emoji]) newReactions[emoji] = [];
        newReactions[emoji] = hasReacted
          ? newReactions[emoji].filter((uid) => uid !== myUid)
          : [...newReactions[emoji], myUid];
        return { ...m, reactions: newReactions };
      })
    );

    try {
      const msgRef = doc(db, "chats", chatId, "messages", messageId);
      const update = { [`reactions.${emoji}`]: arrayUnion(myUid) };
      if (messages.find(m => m.id === messageId)?.reactions?.[emoji]?.includes(myUid)) {
        await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(myUid] });
      } else {
        await updateDoc(msgRef, update);
      }
    } catch {
      toast.error("Failed to react");
    }
  }, [chatId, myUid, messages]);

  // -------------------- SCROLL TO MESSAGE --------------------
  const scrollToMessage = useCallback((id) => {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash-highlight");
      setTimeout(() => el.classList.remove("flash-highlight"), 1200);
    }
  }, []);

  // -------------------- RENDER --------------------
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: wallpaper || (isDark ? "#0b0b0b" : "#f5f5f5"),
        color: isDark ? "#fff" : "#000",
        position: "relative",
      }}
    >
      <style>{FLASH_HIGHLIGHT_STYLE}</style>

      {/* Chat Header */}
      <ChatHeader chatInfo={chatInfo} friendInfo={friendInfo} friendTyping={friendTyping} isDark={isDark} />

      {/* Messages */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: "0 12px" }}>
        {pinnedMessage && (
          <div style={{ padding: 6, backgroundColor: isDark ? "#222" : "#eee", borderRadius: 8, margin: "6px 0" }}>
            📌 Pinned: {pinnedMessage.text}
          </div>
        )}
        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            myUid={myUid}
            setReplyTo={setReplyTo}
            setLongPressMessage={setLongPressMessage}
            handleReact={handleReact}
            ref={(el) => (messageRefs.current[msg.id] = el)}
          />
        ))}
        <div ref={endRef} />
      </div>

      {/* Chat Input */}
      <ChatInput
        value={text}
        onChange={(val) => { setText(val); handleUserTyping(val.length > 0); }}
        onSend={() => sendMessage(text)}
        onOpenEmoji={() => setShowEmojiPicker(true)}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      {/* Long Press Modal */}
      {longPressMessage && (
        <LongPressMessageModal
          message={longPressMessage}
          myUid={myUid}
          onClose={() => setLongPressMessage(null)}
          onReaction={(emoji) => handleReact(longPressMessage.id, emoji)}
          onReply={() => { setReplyTo(longPressMessage); setLongPressMessage(null); scrollToMessage(longPressMessage.id); }}
          onCopy={() => { navigator.clipboard.writeText(longPressMessage.text || ""); setLongPressMessage(null); toast.success("Copied!"); }}
          onPin={async () => { await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: longPressMessage.id }); setPinnedMessage(longPressMessage); setLongPressMessage(null); toast.success("Pinned!"); }}
          onDeleteForMe={async () => { await updateDoc(doc(db, "chats", chatId, "messages", longPressMessage.id), { deletedFor: arrayUnion(myUid) }); setLongPressMessage(null); }}
          onDeleteForEveryone={async () => { await updateDoc(doc(db, "chats", chatId, "messages", longPressMessage.id), { deleted: true }); setLongPressMessage(null); }}
          isDark={isDark}
        />
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <EmojiPicker
          open={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onSelect={(emoji) => { setText(prev => prev + emoji); setShowEmojiPicker(false); }}
          isDark={isDark}
        />
      )}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}