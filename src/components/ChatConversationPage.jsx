// src/components/ChatConversationPage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  getDocs,
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
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";

export default function ChatConversationPage() {
  const { chatId: paramChatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);
  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid || currentUser?.uid;

  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const messageRefs = useRef({});
  const typingTimer = useRef(null);
  const initialScrollDone = useRef(false);

  const [chatId, setChatId] = useState(paramChatId || null);
  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [caption, setCaption] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [mediaViewer, setMediaViewer] = useState({ open: false, startIndex: 0 });
  const [friendTyping, setFriendTyping] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [longPressMessage, setLongPressMessage] = useState(null);
  const [stickyDate, setStickyDate] = useState(null);

  // -------------------- LOAD CHAT & FRIEND --------------------
  useEffect(() => {
    if (!chatId || !myUid) return;

    const chatRef = doc(db, "chats", chatId);
    let unsubChat, unsubFriend, unsubPinned;

    unsubChat = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(Boolean(data.blocked));
      setIsMuted(Boolean(data.mutedUntil && data.mutedUntil > Date.now()));

      // friend info
      const friendId = (data.participants || []).find((p) => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        unsubFriend = onSnapshot(userRef, (s) => {
          if (s.exists()) setFriendInfo({ id: s.id, ...s.data() });
          else setFriendInfo(null);
        });
      } else setFriendInfo(null);

      // pinned message
      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        unsubPinned = onSnapshot(pinnedRef, (s) => {
          if (s.exists()) setPinnedMessage({ id: s.id, ...s.data() });
          else setPinnedMessage(null);
        });
      } else setPinnedMessage(null);

      // typing
      const friendTypingTimestamp = data.typing?.[friendId]?.toDate?.() || Date.now();
      setFriendTyping(Date.now() - friendTypingTimestamp < 3000);
    });

    return () => {
      unsubChat && unsubChat();
      unsubFriend && unsubFriend();
      unsubPinned && unsubPinned();
    };
  }, [chatId, myUid]);

  // -------------------- AUTO CREATE 1:1 CHAT --------------------
  useEffect(() => {
    if (chatId) return;
    if (!currentUser?.selectedUserId) return;
    const participants = [myUid, currentUser.selectedUserId].sort();

    getDocs(query(collection(db, "chats"), orderBy("lastMessageAt", "desc"))).then((snap) => {
      const existing = snap.docs.find((d) => {
        const p = d.data().participants || [];
        return p.length === 2 && p.sort().join() === participants.join();
      });
      if (existing) {
        setChatId(existing.id);
        navigate(`/chat/${existing.id}`);
      } else {
        addDoc(collection(db, "chats"), { participants, createdAt: serverTimestamp() }).then((docRef) => {
          setChatId(docRef.id);
          navigate(`/chat/${docRef.id}`);
        });
      }
    });
  }, [chatId, currentUser, myUid, navigate]);

  // -------------------- MESSAGES SUB --------------------
  useEffect(() => {
    if (!chatId || !myUid) return;

    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
      }));
      setMessages(docs);

      // mark delivered
      docs
        .filter((m) => m.senderId !== myUid && !(m.deliveredTo || []).includes(myUid))
        .forEach((m) =>
          updateDoc(doc(db, "chats", chatId, "messages", m.id), { deliveredTo: arrayUnion(myUid) }).catch(() => {})
        );

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
  const sendMessage = useCallback(async (textMsg = "", files = []) => {
    if (isBlocked) return toast.error("You cannot send messages");
    if (!textMsg && files.length === 0) return;
    if (isMuted) toast.info("This chat is muted");

    const messagesCol = collection(db, "chats", chatId, "messages");
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const tempMessage = {
      id: tempId,
      senderId: myUid,
      text: textMsg?.trim() || "",
      mediaUrls: files.map((f) => (typeof f === "string" ? f : URL.createObjectURL(f))),
      createdAt: new Date(),
      reactions: {},
      seenBy: [],
      deliveredTo: [],
      replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId } : null,
      status: "sending",
      uploadProgress: 0,
    };

    // Optimistic UI
    setMessages((prev) => [...prev, tempMessage]);
    if (isAtBottom) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 40);

    try {
      const uploadedUrls = [];
      for (const file of files) {
        if (typeof file === "string") {
          uploadedUrls.push(file);
          continue;
        }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

        const res = await axios.post(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`,
          formData,
          {
            onUploadProgress: (ev) => {
              const pct = Math.round((ev.loaded * 100) / ev.total);
              setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, uploadProgress: pct } : m)));
            },
          }
        );
        uploadedUrls.push(res.data.secure_url);
      }

      const payload = { ...tempMessage, mediaUrls: uploadedUrls, createdAt: serverTimestamp(), status: "sent" };
      const docRef = await addDoc(messagesCol, payload);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...payload, id: docRef.id, createdAt: new Date() } : m))
      );

      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: textMsg || (files[0]?.name || "Media"),
        lastMessageSender: myUid,
        lastMessageAt: serverTimestamp(),
        lastMessageStatus: "delivered",
      });
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)));
      toast.error("Failed to send message");
    } finally {
      setShowPreview(false);
      setReplyTo(null);
      setText("");
      setSelectedFiles([]);
      setCaption("");
    }
  }, [chatId, myUid, isBlocked, replyTo, isMuted, isAtBottom]);

  // -------------------- SCROLL TO MESSAGE --------------------
  const scrollToMessage = useCallback((id) => {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash-highlight");
      setTimeout(() => el.classList.remove("flash-highlight"), 1200);
    }
  }, []);

  // -------------------- MEDIA VIEWER --------------------
  const mediaItems = useMemo(
    () => messages.filter((m) => m.mediaUrls?.length).flatMap((m) => m.mediaUrls.map((url) => ({ url, id: m.id }))),
    [messages]
  );

  const openMediaViewerAtMessage = useCallback(
    (message) => {
      const index = mediaItems.findIndex((m) => m.id === message.id);
      setMediaViewer({ open: true, startIndex: index >= 0 ? index : 0 });
    },
    [mediaItems]
  );

  // -------------------- DATE HELPERS --------------------
  const formatDateLabel = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString();
  };

  const messagesWithDateSeparators = useMemo(() => {
    const res = [];
    let lastDate = null;
    messages.forEach((m) => {
      const msgDate = new Date(m.createdAt).toDateString();
      if (msgDate !== lastDate) {
        res.push({ type: "date-separator", date: msgDate });
        lastDate = msgDate;
      }
      res.push({ type: "message", data: m });
    });
    return res;
  }, [messages]);

  // -------------------- RENDER --------------------
  if (!myUid || !chatId) return <div style={{ padding: 20 }}>Loading chat...</div>;
  if (!chatInfo || !friendInfo) return <div style={{ padding: 20 }}>Loading chat info...</div>;

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
      {/* Chat Header */}
      <ChatHeader
        friendId={friendInfo.id}
        chatId={chatId}
        pinnedMessage={pinnedMessage}
        setBlockedStatus={setIsBlocked}
        onGoToPinned={() => pinnedMessage && scrollToMessage(pinnedMessage.id)}
      />

      {/* Messages List */}
      <div
        ref={messagesRefEl}
        style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column" }}
      >
        {messagesWithDateSeparators.map((item, idx) => {
          if (item.type === "date-separator") {
            return (
              <div key={`date-${idx}`} style={{ textAlign: "center", margin: "8px 0", color: isDark ? "#888" : "#555", fontSize: 12 }}>
                {formatDateLabel(item.date)}
              </div>
            );
          } else {
            const msg = item.data;
            return (
              <MessageItem
                key={msg.id}
                message={msg}
                myUid={myUid}
                isDark={isDark}
                setReplyTo={setReplyTo}
                scrollToMessage={scrollToMessage}
                openMediaViewer={openMediaViewerAtMessage}
                setLongPressMessage={setLongPressMessage}
                ref={(el) => (messageRefs.current[msg.id] = el)}
              />
            );
          }
        })}
        <div ref={endRef} />
      </div>

      {/* Typing Indicator */}
      {friendTyping && (
        <div style={{ padding: 4, textAlign: "left", color: isDark ? "#aaa" : "#555", fontSize: 12 }}>
          {friendInfo.displayName || "Friend"} is typing...
        </div>
      )}

      {/* Chat Input */}
      <ChatInput
        text={text}
        setText={setText}
        onSend={() => sendMessage(text, selectedFiles)}
        onTyping={handleUserTyping}
        onMediaSelect={(files) => {
          setSelectedFiles(files);
          setShowPreview(true);
        }}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      {/* Image Preview Modal */}
      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          files={selectedFiles}
          caption={caption}
          setCaption={setCaption}
          onSend={(cap, files) => sendMessage(cap || "", files)}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Media Viewer */}
      {mediaViewer.open && (
        <MediaViewer
          items={mediaItems}
          startIndex={mediaViewer.startIndex}
          onClose={() => setMediaViewer({ open: false, startIndex: 0 })}
        />
      )}

      {/* Long Press Message Modal */}
      {longPressMessage && (
        <LongPressMessageModal
          message={longPressMessage}
          onClose={() => setLongPressMessage(null)}
          onReply={() => { setReplyTo(longPressMessage); setLongPressMessage(null); }}
          onPin={async () => {
            await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: longPressMessage.id });
            setPinnedMessage(longPressMessage);
            setLongPressMessage(null);
          }}
          onDeleteForMe={async () => {
            await updateDoc(doc(db, "chats", chatId, "messages", longPressMessage.id), { deletedFor: arrayUnion(myUid) });
            setMessages((prev) => prev.filter((m) => m.id !== longPressMessage.id));
            setLongPressMessage(null);
          }}
          onDeleteForEveryone={async () => {
            await updateDoc(doc(db, "chats", chatId, "messages", longPressMessage.id), { deleted: true });
            setMessages((prev) => prev.filter((m) => m.id !== longPressMessage.id));
            setLongPressMessage(null);
          }}
          onReaction={async (emoji) => {
            const messageId = longPressMessage.id;
            const hasReacted = longPressMessage.reactions?.[emoji]?.includes(myUid);
            const newReactions = { ...longPressMessage.reactions };
            if (!newReactions[emoji]) newReactions[emoji] = [];
            newReactions[emoji] = hasReacted
              ? newReactions[emoji].filter((uid) => uid !== myUid)
              : [...newReactions[emoji], myUid];

            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? { ...m, reactions: newReactions } : m))
            );

            try {
              const msgRef = doc(db, "chats", chatId, "messages", messageId);
              await updateDoc(msgRef, {
                [`reactions.${emoji}`]: hasReacted ? arrayRemove(myUid) : arrayUnion(myUid),
              });
            } catch {
              toast.error("Failed to react");
            }
          }}
          quickReactions={["😜", "💗", "😎", "😍", "☻️", "💖"]}
          isDark={isDark}
        />
      )}

      <ToastContainer position="bottom-right" />
    </div>
  );
}