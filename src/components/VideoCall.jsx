// src/components/VideoCallPage.jsx
import React, { useEffect, useRef, useState, useContext } from "react";
import Video from "twilio-video";
import { useParams, useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";
import { usePopup } from "../context/PopupContext";

export default function VideoCallPage({ backend, setBalance, setTransactions }) {
  const { uid: calleeId } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);
  const { showPopup } = usePopup();
  const isDark = theme === "dark";

  const [connected, setConnected] = useState(false);
  const [roomName, setRoomName] = useState(calleeId || `room-${Date.now()}`);
  const [participants, setParticipants] = useState([]);
  const [seconds, setSeconds] = useState(0);
  const ratePerMinute = 0.12;

  const localRef = useRef();
  const roomRef = useRef();
  const timerRef = useRef();

  // ----------------- Join Room -----------------
  useEffect(() => {
    if (!currentUser) return navigate("/");

    const joinRoom = async () => {
      try {
        const identity = currentUser.uid;
        const tokenResp = await fetch(
          `${backend}/api/twilio/token?identity=${encodeURIComponent(identity)}&room=${encodeURIComponent(roomName)}`
        );
        const tokenData = await tokenResp.json();
        if (!tokenResp.ok) throw new Error(tokenData.message || "Failed to get Twilio token");

        const room = await Video.connect(tokenData.token, { name: roomName, audio: true, video: { width: 1280 } });
        roomRef.current = room;
        setConnected(true);

        // Timer
        timerRef.current = setInterval(() => setSeconds(prev => prev + 1), 1000);

        // Attach local video
        const localTracks = Array.from(room.localParticipant.videoTracks).map(pub => pub.track);
        if (localTracks.length === 0) {
          const tracks = await Video.createLocalTracks({ audio: true, video: { width: 1280 } });
          tracks.forEach(track => attachTrack(localRef.current, track, true));
        } else {
          localTracks.forEach(track => attachTrack(localRef.current, track, true));
        }

        // Existing participants
        Array.from(room.participants.values()).forEach(handleParticipantConnected);

        room.on("participantConnected", participant => {
          handleParticipantConnected(participant);
          setParticipants(prev => [...prev, participant]);
        });

        room.on("participantDisconnected", participant => {
          handleParticipantDisconnected(participant);
          setParticipants(prev => prev.filter(p => p.sid !== participant.sid));
        });

        room.on("disconnected", cleanupRoom);
      } catch (err) {
        console.error(err);
        showPopup(`Failed to join call: ${err.message}`);
        navigate(-1);
      }
    };

    joinRoom();
    return () => cleanupRoom();
  }, [roomName, currentUser]);

  // ----------------- Handle Participants -----------------
  const handleParticipantConnected = participant => {
    const container = document.createElement("div");
    container.id = participant.sid;
    container.className = "remote-participant";
    container.style.position = "relative";
    participant.tracks.forEach(pub => pub.isSubscribed && attachTrack(container, pub.track));
    participant.on("trackSubscribed", track => attachTrack(container, track));
    participant.on("trackUnsubscribed", track => detachTrack(container, track));
    document.getElementById("remoteContainer")?.appendChild(container);
  };

  const attachTrack = (container, track, isLocal = false) => {
    if (!container.querySelector(`video[data-track="${track.sid}"]`)) {
      const el = track.attach();
      el.dataset.track = track.sid;
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.objectFit = "cover";
      el.style.borderRadius = isLocal ? "12px" : "6px";
      container.appendChild(el);
    }
  };

  const detachTrack = (container, track) => {
    try { track.detach().forEach(el => el.remove()); } catch {}
  };

  const handleParticipantDisconnected = participant => {
    document.getElementById(participant.sid)?.remove();
  };

  // ----------------- Billing -----------------
  const chargeWallet = async () => {
    if (!currentUser) return { amount: 0, status: "failed" };
    const cost = ((seconds / 60) * ratePerMinute).toFixed(2);
    const payload = { amount: parseFloat(cost), type: "video_call", roomName, durationSeconds: seconds, calleeId };

    try {
      const token = await currentUser.getIdToken(true);
      const res = await fetch(`${backend}/api/wallet/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setBalance?.(data.newBalance);
        setTransactions?.(prev => [data.transaction, ...prev]);
        return { amount: cost, transaction: data.transaction };
      } else {
        return { amount: cost, status: "failed" };
      }
    } catch (err) {
      console.error(err);
      return { amount: cost, status: "failed" };
    }
  };

  const saveCallHistory = async (billingInfo) => {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken(true);
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

  // ----------------- Cleanup -----------------
  const cleanupRoom = async () => {
    clearInterval(timerRef.current);
    const billingInfo = await chargeWallet();
    await saveCallHistory(billingInfo);

    const room = roomRef.current;
    if (room) {
      room.localParticipant.tracks.forEach(pub => { pub.track.stop?.(); pub.track.detach?.().forEach(n => n.remove()); });
      room.disconnect();
      roomRef.current = null;
    }

    setConnected(false);
    setParticipants([]);
    setSeconds(0);
    navigate("/history");
  };

  const formatTime = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  return (
    <div style={{
      width: "100%",
      height: "100vh",
      background: isDark ? "#000" : "#eef6ff",
      color: isDark ? "#fff" : "#000",
      position: "relative",
      overflow: "hidden"
    }}>
      <button onClick={cleanupRoom} style={{ position: "absolute", top: 12, left: 12, zIndex: 10, padding: 8 }}>← Leave</button>

      {/* Call Duration & Bill */}
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}>
        Duration: {formatTime(seconds)} | Bill: ${((seconds/60)*ratePerMinute).toFixed(2)}
      </div>

      {/* Local Video */}
      <div id="localContainer" ref={localRef} style={{
        position: "absolute",
        bottom: 12,
        right: 12,
        width: 200,
        height: 150,
        borderRadius: 12,
        overflow: "hidden",
        zIndex: 5,
        background: "#000",
      }} />

      {/* Remote Participants Grid */}
      <div id="remoteContainer" style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))`,
        gridAutoRows: "200px",
        gap: "8px",
        width: "100%",
        height: "100%",
        padding: "12px",
        boxSizing: "border-box",
      }} />
    </div>
  );
}
