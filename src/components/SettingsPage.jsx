// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef, useMemo } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";
import confetti from "canvas-confetti";

const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

function useAnimatedNumber(target, duration = 800) {
  const [display, setDisplay] = useState(target);
  const raf = useRef();

  useEffect(() => {
    const start = display;
    const diff = target - start;
    const startTime = performance.now();
    const animate = (time) => {
      const progress = Math.min((time - startTime) / duration, 1);
      setDisplay(start + diff * progress);
      if (progress < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return display;
}

const Section = ({ title, children, isDark }) => (
  <div style={{
    background: isDark ? "#2b2b2b" : "#fff",
    padding: 20,
    borderRadius: 12,
    marginTop: 25,
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
  }}>
    <h3 style={{ marginBottom: 12 }}>{title}</h3>
    {children}
  </div>
);

const btnStyle = (bg) => ({
  padding: "10px 15px",
  background: bg,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: "bold",
});

const selectStyle = (isDark) => ({
  width: "100%",
  padding: 8,
  marginBottom: 10,
  borderRadius: 6,
  background: isDark ? "#222" : "#fafafa",
  color: isDark ? "#fff" : "#000",
  border: "1px solid #666",
});

const previewBox = {
  width: "100%",
  height: 150,
  borderRadius: 10,
  border: "2px solid #555",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  backgroundSize: "cover",
  backgroundPosition: "center",
};

export default function SettingsPage() {
  const { theme, setTheme } = useContext(ThemeContext);
  const { showPopup } = usePopup();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const [user, setUser] = useState(null);
  const [profilePic, setProfilePic] = useState(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loadingReward, setLoadingReward] = useState(false);
  const [flashReward, setFlashReward] = useState(false);
  const animatedBalance = useAnimatedNumber(balance, 800);

  const [preferences, setPreferences] = useState({
    language: "English",
    fontSize: "Medium",
    layout: "Default",
    theme: theme,
    wallpaper: null,
  });

  const [notifications, setNotifications] = useState({ push: true, email: true, sound: true });

  const wallpaperInputRef = useRef(null);
  const backend = "https://smart-talk-zlxe.onrender.com";

  // ---------------- Auth + Wallet ----------------
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/");
      setUser(u);
      setEmail(u.email || "");

      const userRef = doc(db, "users", u.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          name: u.displayName || "User",
          bio: "",
          email: u.email || "",
          profilePic: null,
          preferences: { theme: "light" },
          createdAt: serverTimestamp(),
        });
      }

      const unsubSnap = onSnapshot(userRef, (s) => {
        if (!s.exists()) return;
        const data = s.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
        if (data.preferences) setPreferences((prev) => ({ ...prev, ...data.preferences }));
      });

      await loadWallet(u.uid);
      return () => unsubSnap();
    });

    return () => unsubAuth();
  }, []);

  const getToken = async () => auth.currentUser.getIdToken(true);
  const loadWallet = async (uid) => {
    try {
      const token = await getToken();
      const res = await fetch(`${backend}/api/wallet/${uid}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        setBalance(data.balance || 0);
        setTransactions(data.transactions || []);
      } else {
        showPopup(data.error || "Failed to load wallet.");
      }
    } catch (err) { console.error(err); showPopup("Failed to load wallet."); }
  };

  const alreadyClaimed = useMemo(() => {
    if (!transactions?.length) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return transactions.some((t) => {
      if (t.type !== "checkin") return false;
      const txDate = new Date(t.createdAt || t.date); txDate.setHours(0,0,0,0);
      return txDate.getTime() === today.getTime();
    });
  }, [transactions]);

  const launchConfetti = () => confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
  const handleDailyReward = async () => {
    if (!user || loadingReward || alreadyClaimed) return;
    setLoadingReward(true);
    try {
      const token = await getToken();
      const res = await fetch(`${backend}/api/wallet/daily`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: 0.25 }),
      });
      const data = await res.json();
      if (res.ok) { setBalance(data.balance); setTransactions([data.txn, ...transactions]); showPopup("🎉 Daily reward claimed!"); launchConfetti(); setFlashReward(true); setTimeout(()=>setFlashReward(false),600); }
      else { showPopup(data.error || "Failed to claim daily reward."); }
    } catch(err){ console.error(err); showPopup("Failed to claim daily reward."); } finally { setLoadingReward(false); }
  };

  const handleWallpaperClick = () => wallpaperInputRef.current?.click();
  const handleFileChange = (e) => { const file = e.target.files?.[0]; if(file) setPreferences(p=>({...p, wallpaper: URL.createObjectURL(file)})); };
  const handleSavePreferences = () => { setTheme(preferences.theme); showPopup("Preferences saved!"); };
  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  if(!user) return <p>Loading user...</p>;

  return (
    <div style={{ padding:20, minHeight:"100vh", background: isDark?"#1c1c1c":"#f8f8f8", color: isDark?"#fff":"#000" }}>
      <div style={{ display:"flex", alignItems:"center", marginBottom:16, cursor:"pointer", fontSize:20, fontWeight:"bold" }} onClick={()=>navigate("/chat")}>← Back</div>
      <h2 style={{ textAlign:"center", marginBottom:20 }}>⚙️ Settings</h2>

      {/* ================= Profile Card ================= */}
      <div style={{ display:"flex", alignItems:"center", gap:16, background:isDark?"#2b2b2b":"#fff", padding:16, borderRadius:12, boxShadow:"0 2px 6px rgba(0,0,0,0.15)", marginBottom:25, position:"relative" }}>
        <div style={{ width:88, height:88, borderRadius:44, background:profilePic?`url(${profilePic}) center/cover`:"#888", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, color:"#fff", fontWeight:"bold" }}>{!profilePic && (name?.[0]||"U")}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <h3 style={{ margin:0, fontSize:20 }}>{name}</h3>
          <p style={{ margin:"6px 0", color:isDark?"#ccc":"#555" }}>{bio || "No bio yet"}</p>
          <p style={{ margin:"0 0 12px", color:isDark?"#bbb":"#777", fontSize:13 }}>{email}</p>

          {/* Wallet */}
          <div style={{ padding:16, background:isDark?"#1f1f1f":"#eef6ff", borderRadius:12, cursor:"pointer" }} onClick={()=>navigate("/wallet")}>
            <p style={{ margin:0, fontSize:16 }}>Balance:</p>
            <strong style={{ color:isDark?"#00e676":"#007bff", fontSize:24, display:"inline-block", marginTop:4 }}>${animatedBalance.toFixed(2)}</strong>
            <button onClick={(e)=>{ e.stopPropagation(); handleDailyReward(); }} disabled={loadingReward || alreadyClaimed} style={{ marginTop:12, width:"100%", padding:"12px", borderRadius:10, border:"none", background:alreadyClaimed?"#666":"#ffd700", color:"#000", fontWeight:"bold", fontSize:14, cursor:alreadyClaimed?"not-allowed":"pointer", boxShadow:alreadyClaimed?"none":flashReward?"0 0 15px 5px #ffd700":"0 4px 8px rgba(255,215,0,0.3)" }}>{loadingReward?"Processing...":alreadyClaimed?"✅ Already Claimed":"🧩 Daily Reward (+$0.25)"}</button>
          </div>
        </div>

        {/* Three-dot menu */}
        <div style={{ position:"absolute", top:16, right:16 }}>
          <button onClick={()=>navigate("/edit-profile")} style={{ background:"transparent", border:"none", fontSize:24, cursor:"pointer", color:isDark?"#fff":"#000" }}>⋮</button>
        </div>
      </div>

      {/* ================= Preferences ================= */}
      <Section title="User Preferences" isDark={isDark}>
        <label>Language:</label>
        <select value={preferences.language} onChange={(e)=>setPreferences(p=>({...p, language:e.target.value}))} style={selectStyle(isDark)}>
          <option>English</option>
          <option>French</option>
          <option>Spanish</option>
          <option>Arabic</option>
        </select>

        <label>Font Size:</label>
        <select value={preferences.fontSize} onChange={(e)=>setPreferences(p=>({...p, fontSize:e.target.value}))} style={selectStyle(isDark)}>
          <option>Small</option>
          <option>Medium</option>
          <option>Large</option>
        </select>

        <label>Layout:</label>
        <select value={preferences.layout} onChange={(e)=>setPreferences(p=>({...p, layout:e.target.value}))} style={selectStyle(isDark)}>
          <option>Default</option>
          <option>Compact</option>
          <option>Spacious</option>
        </select>
      </Section>

      {/* ================= Theme & Wallpaper ================= */}
      <Section title="Theme & Wallpaper" isDark={isDark}>
        <select value={preferences.theme} onChange={(e)=>setPreferences(p=>({...p, theme:e.target.value}))} style={selectStyle(isDark)}>
          <option value="light">🌞 Light</option>
          <option value="dark">🌙 Dark</option>
        </select>

        <div onClick={handleWallpaperClick} style={{ ...previewBox, backgroundImage: preferences.wallpaper?`url(${preferences.wallpaper})`:"none" }}>
          <p>🌈 Wallpaper Preview</p>
        </div>
        <input ref={wallpaperInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFileChange} />

        <button onClick={handleSavePreferences} style={btnStyle("#007bff")}>💾 Save Preferences</button>
      </Section>

      {/* ================= Notifications ================= */}
      <Section title="Notifications" isDark={isDark}>
        {Object.keys(notifications).map(key=>(
          <label key={key} style={{ display:"block", marginBottom:6 }}>
            <input type="checkbox" checked={notifications[key]} onChange={()=>setNotifications(n=>({...n,[key]:!n[key]}))}/>
            {" "}{key.charAt(0).toUpperCase()+key.slice(1)}
          </label>
        ))}
      </Section>

      {/* ================= About ================= */}
      <Section title="About" isDark={isDark}>
        <p>Version 1.0.0</p>
        <p>© 2025 Hahala App</p>
        <p>Terms of Service | Privacy Policy</p>
      </Section>
    </div>
  );
}