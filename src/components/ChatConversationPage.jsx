// src/components/ChatConversationPage.jsx
import React, {
  useEffect,
  useState,
  useRef,
  useContext,
  useCallback,
  useMemo,
} from "react";
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
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";

// -------------------- FLASH HIGHLIGHT CSS --------------------
const flashHighlightStyle = `
.flash-highlight {
  animation: flash 1.2s ease;
}
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

  // Long press modal
  const [longPressMessage, setLongPressMessage] = useState(null);

  // -------------------- CHAT & FRIEND SUBS --------------------
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    const unsubList = [];

    const unsubChat = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(Boolean(data.blocked));
      setIsMuted(Boolean(data.mutedUntil && data.mutedUntil > Date.now()));

      const friendId = (data.participants || []).find((p) => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        const unsubFriend = onSnapshot(userRef, (s) =>
          s.exists() && setFriendInfo({ id: s.id, ...s.data() })
        );
        unsubList.push(unsubFriend);
      } else setFriendInfo(null);

      // pinned message
      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        const unsubPinned = onSnapshot(pinnedRef, (s) =>
          s.exists() && setPinnedMessage({ id: s.id, ...s.data() })
        );
        unsubList.push(unsubPinned);
      } else setPinnedMessage(null);

      // typing indicator
      const friendIdForTyping = (data.participants || []).find((p) => p !== myUid);
      setFriendTyping(Boolean(data.typing?.[friendIdForTyping]));
    });

    unsubList.push(unsubChat);
    return () => unsubList.forEach((u) => u());
  }, [chatId, myUid]);

  // -------------------- MESSAGES SUB --------------------
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() || new Date(),
        }));

        setMessages(docs);

        // mark delivered
        docs
          .filter((m) => m.senderId !== myUid && !(m.deliveredTo || []).includes(myUid))
          .forEach((m) => {
            updateDoc(doc(db, "chats", chatId, "messages", m.id), {
              deliveredTo: arrayUnion(myUid),
            }).catch(() => {});
          });

        // scroll to bottom
        if (isAtBottom || !initialScrollDone.current) {
          setTimeout(() => {
            endRef.current?.scrollIntoView({ behavior: "auto" });
            initialScrollDone.current = true;
          }, 50);
        }
      },
      (err) => console.error(err)
    );

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -------------------- MARK SEEN --------------------
  useEffect(() => {
    if (!chatId || !myUid || messages.length === 0) return;
    const unseen = messages.filter(
      (m) => m.senderId !== myUid && !(m.seenBy || []).includes(myUid)
    );
    unseen.forEach((m) => {
      updateDoc(doc(db, "chats", chatId, "messages", m.id), {
        seenBy: arrayUnion(myUid),
      }).catch(() => {});
    });
    updateDoc(doc(db, "chats", chatId), {
      [`lastSeen.${myUid}`]: serverTimestamp(),
    }).catch(() => {});
  }, [messages, chatId, myUid]);

  // -------------------- SCROLL DETECTION --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    let timeout;
    const onScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        setIsAtBottom(atBottom);
      }, 50);
    };
    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => {
      clearTimeout(timeout);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  // -------------------- TYPING --------------------
  const setTypingFlag = useCallback(
    async (typing) => {
      if (!chatId || !myUid) return;
      try {
        await updateDoc(doc(db, "chats", chatId), { [`typing.${myUid}`]: typing });
      } catch {}
    },
    [chatId, myUid]
  );

  const handleUserTyping = useCallback(
    (isTyping) => {
      clearTimeout(typingTimer.current);
      if (isTyping) setTypingFlag(true);
      typingTimer.current = setTimeout(() => setTypingFlag(false), 1500);
    },
    [setTypingFlag]
  );

  // -------------------- REACTIONS --------------------
  const handleReact = useCallback(
    async (messageId, emoji) => {
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
        const snap = await getDoc(msgRef);
        const data = snap.data();
        const userReacted = data?.reactions?.[emoji]?.includes(myUid);
        await updateDoc(msgRef, {
          [`reactions.${emoji}`]: userReacted ? arrayRemove(myUid) : arrayUnion(myUid),
        });
      } catch {
        toast.error("Failed to react");
      }
    },
    [chatId, myUid]
  );

  // -------------------- SEND MESSAGE --------------------
  const sendMessage = useCallback(
    async (textMsg = "", files = []) => {
      if (isBlocked) return toast.error("You cannot send messages to this user");
      if (!textMsg && files.length === 0) return;

      if (isMuted) toast.info("This chat is muted.");

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
        replyTo: replyTo
          ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId }
          : null,
        status: "sending",
        uploadProgress: 0,
      };

      setMessages((prev) => [...prev, tempMessage]);
      if (isAtBottom)
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 40);

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
                setMessages((prev) =>
                  prev.map((m) => (m.id === tempId ? { ...m, uploadProgress: pct } : m))
                );
              },
            }
          );
          uploadedUrls.push(res.data.secure_url);
        }

        const payload = { ...tempMessage, mediaUrls: uploadedUrls, createdAt: serverTimestamp(), status: "sent" };
        const docRef = await addDoc(messagesCol, payload);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...payload, id: docRef.id, createdAt: new Date() } : m
          )
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
      }
    },
    [chatId, myUid, isBlocked, isAtBottom, replyTo, isMuted]
  );

  // -------------------- HELPERS --------------------
  const sendTextHandler = (givenText) => {
    const t = typeof givenText === "string" ? givenText : text;
    if (!t || !t.trim()) return;
    setText("");
    setReplyTo(null);
    sendMessage(t, []);
  };
  const sendMediaHandler = (files) => {
    if (!files?.length) return;
    setSelectedFiles([]);
    setCaption("");
    setShowPreview(false);
    setReplyTo(null);
    sendMessage(caption || "", files);
  };

  const mediaItems = useMemo(
    () =>
      messages
        .filter((m) => m.mediaUrls?.length)
        .flatMap((m) => m.mediaUrls.map((url) => ({ url, id: m.id }))),
    [messages]
  );

  const openMediaViewerAtMessage = useCallback(
    (message) => {
      const index = mediaItems.findIndex((m) => m.id === message.id);
      setMediaViewer({ open: true, startIndex: index >= 0 ? index : 0 });
    },
    [mediaItems]
  );

  const scrollToMessage = useCallback((id) => {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash-highlight");
      setTimeout(() => el.classList.remove("flash-highlight"), 1200);
    }
  }, []);

  const handleDeleteForMe = (message) => {
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    toast.info("Message deleted for you");
    if (pinnedMessage?.id === message.id) setPinnedMessage(null);
  };

  const handleDeleteForEveryone = async (message) => {
    await updateDoc(doc(db, "chats", chatId, "messages", message.id), { deleted: true }).catch(() => {});
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    toast.success("Message deleted for everyone");
    if (pinnedMessage?.id === message.id) setPinnedMessage(null);
  };

  // -------------------- INITIAL SCROLL --------------------
  useEffect(() => {
    if (!chatId) return;
    initialScrollDone.current = false;
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "auto" }), 80);
  }, [chatId]);

  // -------------------- RENDER --------------------
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
      <style>{flashHighlightStyle}</style>

      <ChatHeader
        friendId={friendInfo.id}
        chatId={chatId}
        pinnedMessage={pinnedMessage}
        setBlockedStatus={setIsBlocked}
        onGoToPinned={() => pinnedMessage && scrollToMessage(pinnedMessage.id)}
        onSearch={() => toast.info("Search triggered")}
        onClearChat={async () => {
          const confirmed = window.confirm("Clear all messages?");
          if (!confirmed) return;
          const msgsRef = collection(db, "chats", chatId, "messages");
          const snap = await getDocs(msgsRef);
          await Promise.all(snap.docs.map((m) => updateDoc(doc(db, "chats", chatId, "messages", m.id), { deleted: true })));
          setMessages([]);
          toast.success("Chat cleared");
        }}
        onVoiceCall={() => toast.info("Voice call started")}
        onVideoCall={() => toast.info("Video call started")}
      />

      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column" }}>
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
            onMediaClick={openMediaViewerAtMessage}
            registerRef={(el) => {
              if (el) messageRefs.current[msg.id] = el;
              else delete messageRefs.current[msg.id];
            }}
            onReact={handleReact}
            onDeleteForMe={handleDeleteForMe}
            onDeleteForEveryone={handleDeleteForEveryone}
            onOpenLongPress={(m) => setLongPressMessage(m)}
            isLongPressOpen={longPressMessage?.id === msg.id}
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
        sendTextMessage={sendTextHandler}
        sendMediaMessage={sendMediaHandler}
        disabled={isBlocked}
        friendTyping={friendTyping}
        setTyping={handleUserTyping}
      />

      {/* Image / Media preview modal */}
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
            setSelectedFiles([]);
          }}
          onClose={() => setShowPreview(false)}
          isDark={isDark}
        />
      )}

      {/* Media viewer */}
      {mediaViewer.open && (
        <MediaViewer
          items={mediaItems}
          startIndex={mediaViewer.startIndex}
          onClose={() => setMediaViewer({ open: false, startIndex: 0 })}
        />
      )}

      {/* Long press message modal */}
      {longPressMessage && (
        <LongPressMessageModal
          onClose={() => setLongPressMessage(null)}
          onReaction={(emoji) => handleReact(longPressMessage.id, emoji)}
          onReply={() => {
            setReplyTo(longPressMessage);
            setLongPressMessage(null);
            setTimeout(() => scrollToMessage(longPressMessage.id), 200);
          }}
          onCopy={() => {
            navigator.clipboard.writeText(longPressMessage.text || "");
            toast.success("Copied!");
            setLongPressMessage(null);
          }}
          onPin={async () => {
            await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: longPressMessage.id });
            setPinnedMessage(longPressMessage);
            toast.success("Pinned!");
            setLongPressMessage(null);
          }}
          onDeleteForMe={() => handleDeleteForMe(longPressMessage)}
          onDeleteForEveryone={() => handleDeleteForEveryone(longPressMessage)}
          isDark={isDark}
          messageSenderName={longPressMessage.senderId === myUid ? "You" : friendInfo?.name}
        />
      )}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}