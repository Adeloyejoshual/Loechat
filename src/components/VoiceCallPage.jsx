// src/components/VoiceCallPage.jsx
import React, { useEffect, useRef, useState, useContext } from "react";
import Video from "twilio-video";
import { useParams, useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";
import { usePopup } from "../context/PopupContext";

export default function VoiceCallPage({ backend, setBalance, setTransactions }) {
  const { uid: calleeId } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);
  const { showPopup } = usePopup();
  const isDark = theme === "dark";

  const [connected, setConnected] = useState(false);
  const [roomName, setRoomName] = useState(calleeId || `audio-room-${Date.now()}`);
  const [participants, setParticipants] = useState([]);
  const [seconds, setSeconds] = useState(0);
  const ratePerMinute = 0.08; // example voice call rate

  const roomRef = useRef();
  const timerRef = useRef();
  const remoteRef = useRef();

  // ----------------- Join Room -----------------
  useEffect(() => {
    if (!currentUser) return navigate("/");

    const joinAudio = async () => {
      try {
        const identity = currentUser.uid;
        const resp = await fetch(`${backend}/api/twilio/token?identity=${encodeURIComponent(identity)}&room=${encodeURIComponent(roomName)}`);
        const { token } = await resp.json();

        const room = await Video.connect(token, { name: roomName, audio: true, video: false });
        roomRef.current = room;
        setConnected(true);

        // Timer
        timerRef.current = setInterval(() => setSeconds(prev => prev + 1), 1000);

        // Attach remote audio
        const attachParticipant = (p) => {
          p.tracks.forEach(pub => {
            if (pub.isSubscribed && pub.track.kind === "audio") attachAudio(p.sid, pub.track);
          });
          p.on("trackSubscribed", track => { if (track.kind === "audio") attachAudio(p.sid, track); });
        };

        const attachAudio = (sid, track) => {
          let el = remoteRef.current.querySelector(`[data-sid="${sid}"]`);
          if (!el) {
            el = document.createElement("div");
            el.dataset.sid = sid;
            remoteRef.current.appendChild(el);
          }
          el.appendChild(track.attach());
        };

        room.participants.forEach(attachParticipant);
        room.on("participantConnected", p => {
          attachParticipant(p);
          setParticipants(prev => [...prev, p]);
        });
        room.on("participantDisconnected", p => {
          const el = remoteRef.current.querySelector(`[data-sid="${p.sid}"]`);
          if (el) el.remove();
          setParticipants(prev => prev.filter(part => part.sid !== p.sid));
        });
        room.on("disconnected", cleanup);
      } catch (err) {
        console.error(err);
        showPopup("Could not join audio call: " + err.message);
        navigate(-1);
      }
    };

    joinAudio();
    return () => cleanup();
  }, [currentUser, roomName]);

  // ----------------- Billing -----------------
  const chargeWallet = async () => {
    if (!currentUser) return { amount: 0, status: "failed" };
    const cost = ((seconds / 60) * ratePerMinute).toFixed(2);
    const payload = { amount: parseFloat(cost), type: "voice_call", roomName, durationSeconds: seconds, calleeId };

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
      } else return { amount: cost, status: "failed" };
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
  const cleanup = async () => {
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
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      padding: 12,
      boxSizing: "border-box"
    }}>
      <button onClick={cleanup} style={{ alignSelf: "flex-start", marginBottom: 12, padding: 8 }}>← Hang Up</button>

      <div style={{ marginBottom: 12 }}>Connected: {connected ? "Yes" : "Connecting..."}</div>
      <div style={{ marginBottom: 12 }}>Duration: {formatTime(seconds)} | Bill: ${((seconds/60)*ratePerMinute).toFixed(2)}</div>

      <div ref={remoteRef} style={{
        flex: 1,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        overflowY: "auto",
      }} />

      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
        {participants.length} participant{participants.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}