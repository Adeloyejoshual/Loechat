// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  getDocs,
  limitToLast,
  endBefore
} from "firebase/firestore";

import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";
import ImagePreviewModal from "./Chat/ImagePreviewModal";
import MediaViewer from "./Chat/MediaViewer";

import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import axios from "axios";

const PAGE_SIZE = 40;

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const { theme, wallpaper } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);

  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid || currentUser?.uid;

  // Refs
  const endRef = useRef(null);
  const messagesRefEl = useRef(null);
  const messageRefs = useRef({});

  // States
  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pinnedMessage, setPinnedMessage] = useState(null);

  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [caption, setCaption] = useState("");
  const [replyTo, setReplyTo] = useState(null);

  const [isBlocked, setIsBlocked] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [mediaViewer, setMediaViewer] = useState({ open: false, startIndex: 0 });
  const [isAtBottom, setIsAtBottom] = useState(true);

  // -----------------------------
  // LOAD CHAT AND PINNED MESSAGE
  // -----------------------------
  useEffect(() => {
    if (!chatId) return;

    const chatRef = doc(db, "chats", chatId);

    const unsubChat = onSnapshot(chatRef, async (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(Boolean(data.blocked));

      const friendId = data.participants.find((p) => p !== myUid);

      if (friendId) {
        const userRef = doc(db, "users", friendId);
        onSnapshot(userRef, (u) => u.exists() && setFriendInfo({ id: u.id, ...u.data() }));
      }

      // Load pinned message
      if (data.pinnedMessageId) {
        const pinRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);

        onSnapshot(pinRef, (p) => {
          if (p.exists()) {
            setPinnedMessage({ id: p.id, ...p.data() });
          } else {
            setPinnedMessage(null); // unpinned or deleted
          }
        });
      } else {
        setPinnedMessage(null);
      }

      const friendIdTyping = data.participants.find((p) => p !== myUid);
      setFriendTyping(Boolean(data.typing?.[friendIdTyping]));
    });

    return () => unsubChat();
  }, [chatId, myUid]);

  // -----------------------------
  // REAL-TIME MESSAGES ASC ORDER
  // -----------------------------
  useEffect(() => {
    if (!chatId) return;

    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate
          ? d.data().createdAt.toDate()
          : new Date()
      }));

      setMessages(list);

      if (isAtBottom) {
        endRef.current?.scrollIntoView({ behavior: "auto" });
      }

      // Mark delivered
      list
        .filter((m) => m.senderId !== myUid && !(m.deliveredTo || []).includes(myUid))
        .forEach((m) =>
          updateDoc(doc(db, "chats", chatId, "messages", m.id), {
            deliveredTo: arrayUnion(myUid)
          })
        );
    });

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -----------------------------
  // MARK AS SEEN
  // -----------------------------
  useEffect(() => {
    if (!messages.length) return;

    const unseen = messages.filter(
      (m) => m.senderId !== myUid && !(m.seenBy || []).includes(myUid)
    );

    unseen.forEach((m) =>
      updateDoc(doc(db, "chats", chatId, "messages", m.id), {
        seenBy: arrayUnion(myUid)
      })
    );
  }, [messages, chatId, myUid]);

  // -----------------------------
  // SCROLL DETECTION
  // -----------------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;

    const fn = () =>
      setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);

    el.addEventListener("scroll", fn);
    return () => el.removeEventListener("scroll", fn);
  }, []);

  // -----------------------------
  // SCROLL TO MESSAGE
  // -----------------------------
  const scrollToMessage = (id) => {
    const el = messageRefs.current[id];
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    el.classList.add("flash-highlight");
    setTimeout(() => el.classList.remove("flash-highlight"), 1200);
  };

  // -----------------------------
  // SEND MESSAGE
  // -----------------------------
  const sendMessage = async (textMsg = "", files = []) => {
    if (!textMsg && files.length === 0) return;
    if (isBlocked) {
      toast.error("You cannot send messages to this user");
      return;
    }

    const col = collection(db, "chats", chatId, "messages");

    try {
      const items = files.length ? files : [null];

      for (const f of items) {
        const isFile = Boolean(f);
        const tempId = "temp-" + Math.random();

        let tempMsg = {
          id: tempId,
          text: isFile ? caption : textMsg.trim(),
          senderId: myUid,
          mediaUrl: "",
          mediaType: null,
          createdAt: new Date(),
          reactions: {},
          deliveredTo: [],
          seenBy: [],
          status: "sending",
          uploadProgress: isFile ? 0 : null,
          replyTo: replyTo || null
        };

        if (isFile) {
          const upload = new FormData();
          upload.append("file", f);
          upload.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

          const res = await axios.post(
            `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`,
            upload,
            {
              onUploadProgress: (e) => {
                const pct = Math.round((e.loaded * 100) / e.total);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === tempId ? { ...m, uploadProgress: pct } : m
                  )
                );
              }
            }
          );

          tempMsg.mediaUrl = res.data.secure_url;
          tempMsg.mediaType = f.type.startsWith("image") ? "image" : "video";
        }

        // Optimistic push
        setMessages((prev) => [...prev, tempMsg]);

        const saved = await addDoc(col, {
          ...tempMsg,
          status: "sent",
          createdAt: serverTimestamp()
        });

        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: saved.id,
                  status: "sent",
                  createdAt: new Date()
                }
              : m
          )
        );
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to send message");
    }

    setText("");
    setCaption("");
    setSelectedFiles([]);
    setReplyTo(null);
    setShowPreview(false);
  };

  // -----------------------------
  // OLD MESSAGE PAGINATION
  // -----------------------------
  const loadOlderMessages = async () => {
    if (!messages.length) return;

    const first = messages[0];
    const ref = collection(db, "chats", chatId, "messages");

    const q = query(
      ref,
      orderBy("createdAt", "asc"),
      endBefore(first.createdAt),
      limitToLast(PAGE_SIZE)
    );

    const snap = await getDocs(q);
    if (snap.empty) return;

    const older = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate
        ? d.data().createdAt.toDate()
        : new Date()
    }));

    setMessages((p) => [...older, ...p]);
  };

  // -----------------------------
  // RENDER
  // -----------------------------
  if (!chatInfo || !friendInfo)
    return <div style={{ padding: 20 }}>Loading...</div>;

  const mediaItems = messages
    .filter((m) => m.mediaUrl)
    .map((m) => ({ url: m.mediaUrl, id: m.id, type: m.mediaType }));

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: wallpaper || (isDark ? "#0b0b0b" : "#fafafa")
      }}
    >
      <ChatHeader
        friendId={friendInfo.id}
        chatId={chatId}
        pinnedMessage={pinnedMessage}
        setBlockedStatus={setIsBlocked}
        onGoToPinned={(id) => scrollToMessage(id)}
      />

      <div
        ref={messagesRefEl}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 10,
          display: "flex",
          flexDirection: "column"
        }}
        onScroll={(e) => {
          if (e.currentTarget.scrollTop === 0) loadOlderMessages();
        }}
      >
        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            myUid={myUid}
            isDark={isDark}
            friendInfo={friendInfo}
            onReact={() => {}}
            setReplyTo={setReplyTo}
            setPinnedMessage={async (m) => {
              if (!m.id) return;

              await updateDoc(doc(db, "chats", chatId), {
                pinnedMessageId: m.id
              });
            }}
            onDelete={async (msg) => {
              await updateDoc(doc(db, "chats", chatId, "messages", msg.id), {
                deleted: true
              });
            }}
            onMediaClick={(m) => {
              const i = mediaItems.findIndex((x) => x.id === m.id);
              setMediaViewer({ open: true, startIndex: i });
            }}
            registerRef={(el) => {
              if (el) messageRefs.current[msg.id] = el;
            }}
          />
        ))}

        <div ref={endRef} />
      </div>

      {friendTyping && (
        <div
          style={{
            fontSize: 12,
            opacity: 0.7,
            paddingLeft: 12,
            paddingBottom: 10
          }}
        >
          {friendInfo.name} is typing...
        </div>
      )}

      <ChatInput
        text={text}
        setText={setText}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        sendTextMessage={() => sendMessage(text, selectedFiles)}
        sendMediaMessage={(files) => sendMessage(caption, files)}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        setShowPreview={setShowPreview}
        isDark={isDark}
        disabled={isBlocked}
      />

      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          previews={selectedFiles.map((f) => ({
            file: f,
            url: URL.createObjectURL(f)
          }))}
          caption={caption}
          setCaption={setCaption}
          onRemove={(i) =>
            setSelectedFiles((p) => p.filter((_, idx) => idx !== i))
          }
          onSend={() => sendMessage(caption, selectedFiles)}
          onClose={() => setShowPreview(false)}
        />
      )}

      {mediaViewer.open && (
        <MediaViewer
          items={mediaItems}
          startIndex={mediaViewer.startIndex}
          onClose={() =>
            setMediaViewer({ open: false, startIndex: 0 })
          }
        />
      )}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}