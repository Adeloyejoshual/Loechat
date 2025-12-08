// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  getDoc,
  orderBy,
  query,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";
import ImagePreviewModal from "./Chat/ImagePreviewModal";
import MediaViewer from "./Chat/MediaViewer";
import LongPressMessageModal from "./Chat/LongPressMessageModal";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";

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

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [caption, setCaption] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [mediaViewer, setMediaViewer] = useState({ open: false, startIndex: 0 });
  const [friendTyping, setFriendTyping] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [longPressModal, setLongPressModal] = useState(null);

  // -------------------- Chat & Friend Subscriptions --------------------
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    const unsubList = [];

    const unsubChat = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(Boolean(data.blocked));

      // Friend info
      const friendId = (data.participants || []).find((p) => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        const unsubFriend = onSnapshot(userRef, (s) =>
          s.exists() && setFriendInfo({ id: s.id, ...s.data() })
        );
        unsubList.push(unsubFriend);
      } else setFriendInfo(null);

      // Pinned message
      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        const unsubPinned = onSnapshot(pinnedRef, (s) =>
          s.exists() && setPinnedMessage({ id: s.id, ...s.data() })
        );
        unsubList.push(unsubPinned);
      } else setPinnedMessage(null);

      // Friend typing
      const friendIdForTyping = (data.participants || []).find((p) => p !== myUid);
      setFriendTyping(Boolean(data.typing?.[friendIdForTyping]));
    });

    unsubList.push(unsubChat);
    return () => unsubList.forEach((u) => u());
  }, [chatId, myUid]);

  // -------------------- Real-time Messages --------------------
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

      // Mark delivered
      const undelivered = docs.filter(
        (m) => m.senderId !== myUid && !(m.deliveredTo || []).includes(myUid)
      );
      undelivered.forEach((m) =>
        updateDoc(doc(db, "chats", chatId, "messages", m.id), { deliveredTo: arrayUnion(myUid) })
      );

      if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "auto" });
    });

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -------------------- Mark Seen --------------------
  useEffect(() => {
    if (!chatId || !myUid || !messages.length) return;
    const unseen = messages.filter(
      (m) => m.senderId !== myUid && !(m.seenBy || []).includes(myUid)
    );
    unseen.forEach((m) =>
      updateDoc(doc(db, "chats", chatId, "messages", m.id), { seenBy: arrayUnion(myUid) })
    );
    updateDoc(doc(db, "chats", chatId), { [`lastSeen.${myUid}`]: serverTimestamp() });
  }, [messages, chatId, myUid]);

  // -------------------- Scroll Detection --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () =>
      setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // -------------------- Typing --------------------
  const setTypingFlag = async (typing) => {
    if (!chatId || !myUid) return;
    try {
      await updateDoc(doc(db, "chats", chatId), { [`typing.${myUid}`]: typing });
    } catch (e) {
      console.warn("Typing write failed", e);
    }
  };

  const handleUserTyping = (isTyping) => {
    if (isTyping) {
      setTypingFlag(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingFlag(false), 1800);
    } else {
      setTypingFlag(false);
      typingTimer.current && clearTimeout(typingTimer.current);
    }
  };

  // -------------------- Reaction Toggle --------------------
  const handleReact = useCallback(
    async (messageId, emoji) => {
      if (!chatId || !messageId || !myUid) return;
      const msgRef = doc(db, "chats", chatId, "messages", messageId);
      try {
        const snap = await getDoc(msgRef);
        const data = snap.data();
        const userReacted = data?.reactions?.[emoji]?.includes(myUid);
        await updateDoc(msgRef, {
          [`reactions.${emoji}`]: userReacted ? arrayRemove(myUid) : arrayUnion(myUid),
        });
      } catch (err) {
        console.error("React failed", err);
      }
    },
    [chatId, myUid]
  );

  // -------------------- Send Message (with multiple images) --------------------
  const sendMessage = useCallback(
    async (textMsg = "", files = []) => {
      if (isBlocked) {
        toast.error("You cannot send messages to this user");
        return;
      }
      if (!textMsg && files.length === 0) return;

      const messagesCol = collection(db, "chats", chatId, "messages");

      try {
        // Temporary message
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const tempMessage = {
          id: tempId,
          senderId: myUid,
          text: textMsg.trim(),
          mediaUrls: files.map((f) => URL.createObjectURL(f)),
          mediaType: files.length ? "image" : null,
          createdAt: new Date(),
          reactions: {},
          seenBy: [],
          deliveredTo: [],
          replyTo: replyTo
            ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId }
            : null,
          status: "sending",
          uploadProgress: 0,
        };

        setMessages((prev) => [...prev, tempMessage]);
        if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });

        // Upload files to Cloudinary
        const uploadedUrls = [];
        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

          const res = await axios.post(
            `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`,
            formData,
            {
              onUploadProgress: (ev) => {
                const pct = Math.round((ev.loaded * 100) / ev.total);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === tempId ? { ...m, uploadProgress: pct } : m
                  )
                );
              },
            }
          );
          uploadedUrls.push(res.data.secure_url);
        }

        // Persist message
        const payload = {
          ...tempMessage,
          mediaUrls: uploadedUrls,
          createdAt: serverTimestamp(),
          status: "sent",
        };
        const docRef = await addDoc(messagesCol, payload);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...payload, id: docRef.id, createdAt: new Date() } : m
          )
        );

        // Update chat last message
        const chatRef = doc(db, "chats", chatId);
        await updateDoc(chatRef, {
          lastMessage: textMsg || (files[0]?.name || "Media"),
          lastMessageSender: myUid,
          lastMessageAt: serverTimestamp(),
          lastMessageStatus: "delivered",
        });
      } catch (err) {
        console.error("Send message failed:", err);
        toast.error("Failed to send message");
        setMessages((prev) =>
          prev.map((m) => (m.status === "sending" ? { ...m, status: "failed" } : m))
        );
      } finally {
        setText("");
        setSelectedFiles([]);
        setCaption("");
        setReplyTo(null);
        setShowPreview(false);
      }
    },
    [chatId, myUid, isBlocked, isAtBottom, replyTo]
  );

  // -------------------- Media Viewer --------------------
  const mediaItems = messages
    .filter((m) => m.mediaUrls?.length)
    .flatMap((m) => m.mediaUrls.map((url) => ({ url, id: m.id })));

  const openMediaViewerAtMessage = useCallback(
    (message) => {
      const index = mediaItems.findIndex((m) => m.id === message.id);
      setMediaViewer({ open: true, startIndex: index >= 0 ? index : 0 });
    },
    [mediaItems]
  );

  // -------------------- Scroll to Message --------------------
  const scrollToMessage = useCallback((id) => {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash-highlight");
      setTimeout(() => el.classList.remove("flash-highlight"), 1200);
    }
  }, []);

  // -------------------- Render --------------------
  if (!chatInfo || !friendInfo) return <div style={{ padding: 20 }}>Loading chat...</div>;

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
      <ChatHeader
        friendId={friendInfo.id}
        chatId={chatId}
        pinnedMessage={pinnedMessage}
        setBlockedStatus={setIsBlocked}
        onGoToPinned={() => pinnedMessage && scrollToMessage(pinnedMessage.id)}
      />

      <div
        ref={messagesRefEl}
        style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column" }}
      >
        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            myUid={myUid}
            isDark={isDark}
            setReplyTo={setReplyTo}
            setPinnedMessage={(m) => {
              if (!m?.id) return;
              updateDoc(doc(db, "chats", chatId), { pinnedMessageId: m.id }).catch(console.error);
              setPinnedMessage(m);
            }}
            friendInfo={friendInfo}
            onMediaClick={openMediaViewerAtMessage}
            registerRef={(el) => {
              if (el) messageRefs.current[msg.id] = el;
              else delete messageRefs.current[msg.id];
            }}
            onReact={handleReact}
            onDelete={(messageToDelete) => setLongPressModal(messageToDelete)}
          />
        ))}

        <div ref={endRef} />
      </div>

      {friendTyping && (
        <div style={{ padding: "0 12px 6px 12px", fontSize: 12, color: isDark ? "#ccc" : "#555" }}>
          {friendInfo?.name || "Contact"} is typing...
        </div>
      )}

      <ChatInput
        text={text}
        setText={setText}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        setShowPreview={setShowPreview}
        isDark={isDark}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        sendTextMessage={() => sendMessage(text, [])}
        sendMediaMessage={(files) => sendMessage(caption, files)}
        disabled={isBlocked}
        friendTyping={friendTyping}
        setTyping={handleUserTyping}
      />

      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          previews={selectedFiles.map((f) => ({ file: f, url: URL.createObjectURL(f) }))}
          caption={caption}
          setCaption={setCaption}
          onRemove={(i) => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))}
          onSend={async () => {
            await sendMessage(caption, selectedFiles);
            setShowPreview(false);
            setCaption("");
          }}
          onClose={() => setShowPreview(false)}
          isDark={isDark}
        />
      )}

      {mediaViewer.open && (
        <MediaViewer
          items={mediaItems}
          startIndex={mediaViewer.startIndex}
          onClose={() => setMediaViewer({ open: false, startIndex: 0 })}
        />
      )}

      {longPressModal && (
        <LongPressMessageModal
          onClose={() => setLongPressModal(null)}
          onReaction={(emoji) => handleReact(longPressModal.id, emoji)}
          onReply={() => {
            setReplyTo(longPressModal);
            setLongPressModal(null);
          }}
          onCopy={() => {
            navigator.clipboard.writeText(longPressModal.text || "");
            toast.success("Copied!");
            setLongPressModal(null);
          }}
          onPin={async () => {
            await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: longPressModal.id });
            setPinnedMessage(longPressModal);
            toast.success("Pinned!");
            setLongPressModal(null);
          }}
          onDelete={async () => {
            await updateDoc(doc(db, "chats", chatId, "messages", longPressModal.id), { deleted: true });
            setLongPressModal(null);
          }}
          isDark={isDark}
          messageSenderName={longPressModal.senderId === myUid ? "You" : friendInfo.name}
        />
      )}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}