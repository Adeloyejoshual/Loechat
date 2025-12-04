import React, { useEffect, useRef, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";
import { usePopup } from "../context/PopupContext";
import io from "socket.io-client";

export default function VoiceCallPage({ backend, setBalance, setTransactions }) {
  const { uid: calleeId } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);
  const { showPopup } = usePopup();
  const isDark = theme === "dark";

  const [connected, setConnected] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const ratePerMinute = 0.08;

  const localStreamRef = useRef(null);
  const pcsRef = useRef({}); // peer connections
  const socketRef = useRef(null);
  const remoteRefs = useRef({});
  const timerRef = useRef();

  const roomName = calleeId || `audio-room-${Date.now()}`;

  useEffect(() => {
    if (!currentUser) return navigate("/");

    const joinCall = async () => {
      try {
        socketRef.current = io(`${backend}`);
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        // Timer
        setConnected(true);
        timerRef.current = setInterval(() => setSeconds(prev => prev + 1), 1000);

        socketRef.current.on("new-participant", async ({ from }) => {
          await createPeer(from, true);
        });

        socketRef.current.on("offer", async ({ from, offer }) => {
          await createPeer(from, false);
          await pcsRef.current[from].setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pcsRef.current[from].createAnswer();
          await pcsRef.current[from].setLocalDescription(answer);
          socketRef.current.emit("answer", { to: from, answer });
        });

        socketRef.current.on("answer", async ({ from, answer }) => {
          await pcsRef.current[from].setRemoteDescription(new RTCSessionDescription(answer));
        });

        socketRef.current.on("ice-candidate", async ({ from, candidate }) => {
          if (pcsRef.current[from]) await pcsRef.current[from].addIceCandidate(new RTCIceCandidate(candidate));
        });

        socketRef.current.emit("join-room", { userId: currentUser.uid, room: roomName });
      } catch (err) {
        console.error(err);
        showPopup("Could not join call: " + err.message);
        navigate(-1);
      }
    };

    joinCall();
    return () => cleanup();
  }, [currentUser, roomName]);

  const createPeer = async (peerId, isOfferer) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pcsRef.current[peerId] = pc;

    localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

    pc.ontrack = event => {
      if (!remoteRefs.current[peerId]) {
        const el = document.createElement("audio");
        el.autoplay = true;
        el.srcObject = event.streams[0];
        remoteRefs.current[peerId] = el;
        document.getElementById("remoteContainer").appendChild(el);
      }
    };

    pc.onicecandidate = event => {
      if (event.candidate) socketRef.current.emit("ice-candidate", { to: peerId, candidate: event.candidate });
    };

    if (isOfferer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit("offer", { to: peerId, offer });
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setMuted(!muted);
    }
  };

  const cleanup = async () => {
    clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    Object.values(pcsRef.current).forEach(pc => pc.close());
    socketRef.current?.disconnect();
    setConnected(false);
    setSeconds(0);
    navigate("/history");
  };

  const formatTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{
      width: "100%",
      height: "100vh",
      background: isDark ? "#000" : "#eef6ff",
      color: isDark ? "#fff" : "#000",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: 12
    }}>
      <button onClick={cleanup} style={{ marginBottom: 12 }}>← Hang Up</button>
      <button onClick={toggleMute} style={{ marginBottom: 12 }}>{muted ? "Unmute" : "Mute"}</button>
      <div>Connected: {connected ? "Yes" : "Connecting..."}</div>
      <div>Duration: {formatTime(seconds)} | Bill: ${((seconds / 60) * ratePerMinute).toFixed(2)}</div>
      <div id="remoteContainer" style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }} />
    </div>
  );
}