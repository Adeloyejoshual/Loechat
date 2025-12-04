// src/components/VoiceCallPage.jsx
import React, { useEffect, useRef, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import io from "socket.io-client";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";
import { usePopup } from "../context/PopupContext";
import { auth } from "../firebaseConfig";

export default function VoiceCallPage({ backend = window.location.origin, setBalance, setTransactions }) {
  const { uid: calleeId } = useParams(); // used as room name or callee identifier
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);
  const { showPopup } = usePopup();
  const isDark = theme === "dark";

  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState([]); // remote socket ids
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const ratePerMinute = 0.08;

  // refs
  const socketRef = useRef(null);
  const pcsRef = useRef({}); // peer connections keyed by remote socket id
  const localStreamRef = useRef(null);
  const remoteContainerRef = useRef(null);
  const timerRef = useRef(null);

  // room name: use calleeId if provided, otherwise unique room
  const roomName = calleeId || `audio-room-${Date.now()}`;

  // ICE servers — you should add TURN server(s) for production
  const ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    // { urls: "turn:your.turn.server:3478", username: "user", credential: "pass" },
  ];

  // -------------------- Join Room & Setup --------------------
  useEffect(() => {
    if (!currentUser) {
      navigate("/");
      return;
    }

    let mounted = true;

    const start = async () => {
      try {
        // connect socket.io
        socketRef.current = io(backend, { transports: ["websocket", "polling"] });

        // get local audio (microphone)
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        // show local audio element (muted)
        createOrUpdateLocalAudioElement(localStreamRef.current);

        // socket event handlers
        socketRef.current.on("connect", () => {
          // join the room and announce presence
          socketRef.current.emit("join-room", { userId: currentUser.uid, room: roomName });
        });

        // someone new joined — we should create an offer to them
        socketRef.current.on("new-participant", async ({ from }) => {
          if (!mounted) return;
          await createPeerConnection(from, true);
          setParticipants((prev) => Array.from(new Set([...prev, from])));
        });

        // when we receive an offer
        socketRef.current.on("offer", async ({ from, offer }) => {
          if (!mounted) return;
          await createPeerConnection(from, false);
          const pc = pcsRef.current[from];
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current.emit("answer", { to: from, answer });
          setParticipants((prev) => Array.from(new Set([...prev, from])));
        });

        // when we receive an answer
        socketRef.current.on("answer", async ({ from, answer }) => {
          if (!mounted) return;
          const pc = pcsRef.current[from];
          if (pc && answer) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
          }
        });

        // ICE candidate forwarded from remote
        socketRef.current.on("ice-candidate", async ({ from, candidate }) => {
          if (!mounted) return;
          const pc = pcsRef.current[from];
          if (pc && candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.warn("addIceCandidate error", err);
            }
          }
        });

        // handle disconnects from server side
        socketRef.current.on("disconnect", (reason) => {
          console.log("Socket disconnected:", reason);
        });

        // start timer and mark connected
        setConnected(true);
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      } catch (err) {
        console.error("Join call error:", err);
        showPopup?.("Could not join call: " + (err.message || err));
        navigate(-1);
      }
    };

    start();

    return () => {
      mounted = false;
      cleanup(); // ensure cleanup on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, roomName]);

  // -------------------- PeerConnection factory --------------------
  const createPeerConnection = async (peerSocketId, isOfferer = false) => {
    if (pcsRef.current[peerSocketId]) return pcsRef.current[peerSocketId];

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcsRef.current[peerSocketId] = pc;

    // add local audio tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current));
    }

    // when remote track arrives, create audio element
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      attachRemoteStream(peerSocketId, stream);
    };

    // ICE candidates -> send to remote via signaling server
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice-candidate", { to: peerSocketId, candidate: event.candidate });
      }
    };

    // handle connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "failed" || state === "disconnected" || state === "closed") {
        removeParticipant(peerSocketId);
      }
    };

    if (isOfferer) {
      // create offer
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current.emit("offer", { to: peerSocketId, offer });
      } catch (err) {
        console.error("Offer error:", err);
      }
    }

    return pc;
  };

  // -------------------- Attach / detach remote audio elements --------------------
  const attachRemoteStream = (peerId, stream) => {
    const container = remoteContainerRef.current;
    if (!container) return;

    // if element exists, replace srcObject
    let el = container.querySelector(`[data-sid="${peerId}"]`);
    if (!el) {
      el = document.createElement("div");
      el.dataset.sid = peerId;
      el.style.padding = "6px 0";
      const label = document.createElement("div");
      label.textContent = `Participant: ${peerId}`;
      label.style.fontSize = "12px";
      label.style.color = isDark ? "#ddd" : "#333";
      el.appendChild(label);

      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.controls = false;
      audio.style.display = "block";
      el.appendChild(audio);

      container.appendChild(el);
    }

    const audioEl = el.querySelector("audio");
    if (audioEl) audioEl.srcObject = stream;
  };

  const removeParticipant = (peerId) => {
    // close pc
    const pc = pcsRef.current[peerId];
    if (pc) {
      try { pc.close(); } catch (e) {}
      delete pcsRef.current[peerId];
    }
    // remove DOM
    const container = remoteContainerRef.current;
    if (container) {
      const el = container.querySelector(`[data-sid="${peerId}"]`);
      if (el) el.remove();
    }
    setParticipants((prev) => prev.filter((p) => p !== peerId));
  };

  const createOrUpdateLocalAudioElement = (stream) => {
    // hidden local audio element (muted)
    let el = document.getElementById("local-audio-el");
    if (!el) {
      el = document.createElement("audio");
      el.id = "local-audio-el";
      el.autoplay = true;
      el.muted = true;
      el.style.display = "none";
      document.body.appendChild(el);
    }
    el.srcObject = stream;
  };

  // -------------------- Mute / Unmute --------------------
  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMuted((m) => !m);
  };

  // -------------------- Billing (unchanged logic) --------------------
  const chargeWallet = async () => {
    if (!currentUser) return { amount: 0, status: "failed" };
    const cost = ((seconds / 60) * ratePerMinute).toFixed(2);
    const payload = { amount: parseFloat(cost), type: "voice_call", roomName, durationSeconds: seconds, calleeId };

    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await fetch(`${backend}/api/wallet/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setBalance?.(data.newBalance);
        setTransactions?.((prev) => [data.transaction, ...prev]);
        return { amount: cost, transaction: data.transaction };
      } else {
        return { amount: cost, status: "failed" };
      }
    } catch (err) {
      console.error("Charge error:", err);
      return { amount: cost, status: "failed" };
    }
  };

  const saveCallHistory = async (billingInfo) => {
    if (!currentUser) return;
    try {
      const token = await auth.currentUser.getIdToken(true);
      await fetch(`${backend}/api/callHistory`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: currentUser.uid,
          calleeId,
          roomName,
          durationSeconds: seconds,
          amount: billingInfo.amount,
          transactionId: billingInfo.transaction?._id,
          timestamp: new Date(),
          status: "completed",
        }),
      });
    } catch (err) {
      console.error("Save call history error", err);
    }
  };

  // -------------------- Hang up / Cleanup --------------------
  const cleanup = async () => {
    try {
      clearInterval(timerRef.current);

      // charge and save
      const billingInfo = await chargeWallet();
      await saveCallHistory(billingInfo);
    } catch (err) {
      console.warn("Billing/History error during cleanup", err);
    }

    // stop local tracks
    localStreamRef.current?.getTracks().forEach((t) => {
      try { t.stop(); } catch (e) {}
    });

    // close all peer connections
    Object.values(pcsRef.current).forEach((pc) => {
      try { pc.close(); } catch (e) {}
    });
    pcsRef.current = {};

    // remove remote audio elements
    const container = remoteContainerRef.current;
    if (container) container.innerHTML = "";

    // disconnect socket
    try { socketRef.current?.disconnect(); } catch (e) {}

    setConnected(false);
    setParticipants([]);
    setSeconds(0);

    // navigate to history (same as original)
    navigate("/history");
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // -------------------- UI --------------------
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: isDark ? "#000" : "#eef6ff",
        color: isDark ? "#fff" : "#000",
        display: "flex",
        flexDirection: "column",
        padding: 12,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <button onClick={cleanup} style={{ padding: 8 }}>← Hang Up</button>
        <div style={{ fontWeight: 600 }}>{connected ? "In Call" : "Connecting..."}</div>
        <div style={{ marginLeft: "auto" }}>Duration: {formatTime(seconds)}</div>
        <div style={{ marginLeft: 12 }}>Bill: ${((seconds / 60) * ratePerMinute).toFixed(2)}</div>
        <button onClick={toggleMute} style={{ marginLeft: 12, padding: 8 }}>{muted ? "Unmute" : "Mute"}</button>
      </div>

      <div
        ref={remoteContainerRef}
        style={{
          flex: 1,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          overflowY: "auto",
        }}
      />

      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
        {participants.length} participant{participants.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}