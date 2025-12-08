// src/components/AdminDashboard.jsx
import React, { useEffect, useState, useContext, useMemo } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  getDocs,
  collectionGroup,
  limit,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { FiUsers, FiAlertCircle, FiCheckCircle, FiTrash2, FiCheck, FiSlash, FiSearch, FiDownload } from "react-icons/fi";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { exportToCsv } from "../utils/exportCsv";
import UserDetailModal from "./UserDetailModal";

export default function AdminDashboard() {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";

  // data
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // filters & UI
  const [statusFilter, setStatusFilter] = useState("All");
  const [blockedFilter, setBlockedFilter] = useState("All"); // All / Blocked / NotBlocked
  const [severityFilter, setSeverityFilter] = useState("All"); // if your reports have severity
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [reportsPerPage, setReportsPerPage] = useState(10);

  // modal
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);

  // real-time subscription on reports
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "reports"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setReports(arr);
        setLoading(false);
      },
      (err) => {
        console.error("reports onSnapshot error", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // derived filtered list
  const filteredReports = useMemo(() => {
    let temp = [...reports];

    if (statusFilter !== "All") {
      temp = temp.filter((r) => (r.status || "Pending") === statusFilter);
    }

    if (blockedFilter !== "All") {
      temp = temp.filter((r) => {
        // if reported user doc has blocked flag inside report, use that. Otherwise try to fetch? For speed, reports may carry snapshot of user status
        const isBlocked = Boolean(r.reportedBlocked);
        return blockedFilter === "Blocked" ? isBlocked : !isBlocked;
      });
    }

    if (severityFilter !== "All") {
      temp = temp.filter((r) => (r.severity || "Normal") === severityFilter);
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      temp = temp.filter((r) => r.timestamp?.seconds ? new Date(r.timestamp.seconds * 1000) >= from : false);
    }
    if (dateTo) {
      // include full day
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      temp = temp.filter((r) => r.timestamp?.seconds ? new Date(r.timestamp.seconds * 1000) <= to : false);
    }

    if (searchQuery.trim()) {
      const ql = searchQuery.toLowerCase();
      temp = temp.filter(
        (r) =>
          (String(r.reportedName || r.reportedId || "").toLowerCase().includes(ql)) ||
          (String(r.reporterId || "").toLowerCase().includes(ql)) ||
          (String(r.reason || "").toLowerCase().includes(ql))
      );
    }

    return temp;
  }, [reports, statusFilter, blockedFilter, severityFilter, dateFrom, dateTo, searchQuery]);

  // stats
  const totalReports = reports.length;
  const pendingReports = reports.filter((r) => !r.status || r.status === "Pending").length;
  const reviewedReports = reports.filter((r) => r.status === "Reviewed").length;
  const deletedReports = reports.filter((r) => r.status === "Deleted").length;

  const chartData = [
    { name: "Pending", value: pendingReports, color: "#f59e0b" },
    { name: "Reviewed", value: reviewedReports, color: "#10b981" },
    { name: "Deleted", value: deletedReports, color: "#ef4444" },
  ];

  // pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredReports.length / reportsPerPage));
  const indexOfLast = currentPage * reportsPerPage;
  const indexOfFirst = indexOfLast - reportsPerPage;
  const currentReports = filteredReports.slice(indexOfFirst, indexOfLast);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages]);

  // ---------------- Actions ----------------
  const markReviewed = async (reportId) => {
    try {
      await updateDoc(doc(db, "reports", reportId), { status: "Reviewed", reviewedAt: new Date() });
    } catch (err) {
      console.error(err);
      alert("Failed to mark reviewed");
    }
  };

  const resolveReport = async (reportId) => {
    try {
      await updateDoc(doc(db, "reports", reportId), { status: "Resolved", resolvedAt: new Date() });
    } catch (err) {
      console.error(err);
      alert("Failed to resolve");
    }
  };

  const deleteReport = async (reportId) => {
    if (!window.confirm("Permanently delete this report? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "reports", reportId));
    } catch (err) {
      console.error(err);
      alert("Failed to delete");
    }
  };

  // block user permanently
  const blockUser = async (userId) => {
    if (!window.confirm(`Block user ${userId} permanently?`)) return;
    try {
      await updateDoc(doc(db, "users", userId), { blocked: true });
      // optional: attach a snapshot field on reports for quick filtering
      // inform backend to send email
      await notifyAdminAction("block", userId);
      alert(`User ${userId} has been blocked.`);
    } catch (err) {
      console.error(err);
      alert("Failed to block user");
    }
  };

  // suspend user for days (1,7,30)
  const suspendUser = async (userId, days) => {
    if (!window.confirm(`Suspend user ${userId} for ${days} day(s)?`)) return;
    try {
      const until = new Date();
      until.setDate(until.getDate() + days);
      // store as Firestore timestamp
      await updateDoc(doc(db, "users", userId), { suspendedUntil: until });
      await notifyAdminAction("suspend", userId, { until: until.toISOString(), days });
      alert(`User ${userId} suspended for ${days} day(s).`);
    } catch (err) {
      console.error(err);
      alert("Failed to suspend user");
    }
  };

  // notify cloud function, optional (calls your deployed function)
  const notifyAdminAction = async (action, userId, meta = {}) => {
    try {
      // replace URL with your deployed cloud function endpoint
      const fnUrl = import.meta.env.VITE_ADMIN_ACTION_FN_URL;
      if (!fnUrl) return;
      await fetch(fnUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId, meta }),
      });
    } catch (err) {
      console.warn("notifyAdminAction failed:", err);
    }
  };

  // open user dialog
  const openUserModal = (userId) => {
    setSelectedUserId(userId);
    setShowUserModal(true);
  };

  // export visible reports to CSV
  const handleExportCsv = () => {
    const rows = filteredReports.map((r) => ({
      id: r.id,
      reportedId: r.reportedId || "",
      reportedName: r.reportedName || "",
      reporterId: r.reporterId || "",
      reason: r.reason || "",
      status: r.status || "Pending",
      severity: r.severity || "",
      timestamp: r.timestamp?.seconds ? new Date(r.timestamp.seconds * 1000).toISOString() : "",
    }));
    exportToCsv(`reports_${new Date().toISOString().slice(0,10)}.csv`, rows);
  };

  // fetch reported user's current blocked state to help filters (lightweight on-demand)
  const enrichReportsWithUserState = async () => {
    // We will fetch unique user ids from current set and add their blocked/suspended state into the report objects for quick filtering
    try {
      const ids = Array.from(new Set(reports.map((r) => r.reportedId).filter(Boolean)));
      const results = await Promise.all(ids.map((id) => getDocs(query(collection(db, "users"), where("__name__", "==", id)))));
      const map = {};
      results.forEach((snap) => {
        snap.docs.forEach((d) => {
          map[d.id] = d.data();
        });
      });
      setReports((prev) => prev.map((r) => ({ ...r, reportedBlocked: Boolean(map[r.reportedId]?.blocked), reportedSuspendedUntil: map[r.reportedId]?.suspendedUntil || null })));
    } catch (err) {
      console.warn("Failed to enrich reports with user state", err);
    }
  };

  useEffect(() => {
    // enrich occasionally
    const t = setTimeout(() => enrichReportsWithUserState(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports.length]);

  if (loading) return (<div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-gray-900 text-white" : "bg-gray-100 text-black"}`}>Loading dashboard...</div>);

  return (
    <div className={`min-h-screen p-6 ${isDark ? "bg-gray-900 text-white" : "bg-gray-100 text-black"}`}>
      <h1 className="text-3xl font-bold mb-6">🛠 LoeChat Admin Dashboard</h1>

      {/* Top controls */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6 items-start">
        <div className="flex gap-3 items-center">
          <div className={`p-4 rounded-lg shadow ${isDark ? "bg-gray-800" : "bg-white"}`}>
            <div className="flex items-center gap-3">
              <FiAlertCircle className="text-yellow-500 text-2xl" />
              <div>
                <p className="text-sm text-gray-400">Pending Reports</p>
                <p className="text-xl font-bold">{pendingReports}</p>
              </div>
            </div>
          </div>
          <div className={`p-4 rounded-lg shadow ${isDark ? "bg-gray-800" : "bg-white"}`}>
            <div className="flex items-center gap-3">
              <FiCheckCircle className="text-green-500 text-2xl" />
              <div>
                <p className="text-sm text-gray-400">Reviewed Reports</p>
                <p className="text-xl font-bold">{reviewedReports}</p>
              </div>
            </div>
          </div>
          <div className={`p-4 rounded-lg shadow ${isDark ? "bg-gray-800" : "bg-white"}`}>
            <div className="flex items-center gap-3">
              <FiTrash2 className="text-red-500 text-2xl" />
              <div>
                <p className="text-sm text-gray-400">Deleted Reports</p>
                <p className="text-xl font-bold">{deletedReports}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="ml-auto flex gap-3 items-center">
          <button onClick={handleExportCsv} className="px-3 py-2 rounded bg-blue-600 text-white flex items-center gap-2">
            <FiDownload /> Export CSV
          </button>
        </div>
      </div>

      {/* Chart & Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className={`col-span-2 p-4 rounded-lg shadow ${isDark ? "bg-gray-800" : "bg-white"}`}>
          <h2 className="text-lg font-semibold mb-2">Reports</h2>

          {/* filters */}
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="p-2 rounded border">
              <option>All</option>
              <option>Pending</option>
              <option>Reviewed</option>
              <option>Resolved</option>
              <option>Deleted</option>
            </select>
            <select value={blockedFilter} onChange={(e) => setBlockedFilter(e.target.value)} className="p-2 rounded border">
              <option value="All">All users</option>
              <option value="Blocked">Blocked</option>
              <option value="NotBlocked">Not blocked</option>
            </select>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="p-2 rounded border">
              <option value="All">All severities</option>
              <option value="Low">Low</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
            </select>

            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="p-2 rounded border" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="p-2 rounded border" />

            <div className="flex items-center border rounded p-2">
              <FiSearch className="mr-2" />
              <input placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent outline-none text-sm" />
            </div>
          </div>

          {/* table */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-200 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left">Reported</th>
                  <th className="px-4 py-2 text-left">Reporter</th>
                  <th className="px-4 py-2 text-left">Reason</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentReports.map((report) => (
                  <tr key={report.id} className="border-b border-gray-300 dark:border-gray-600">
                    <td className="px-4 py-2">
                      <button className="font-medium" onClick={() => openUserModal(report.reportedId)}>{report.reportedName || report.reportedId}</button>
                      <div className="text-xs text-gray-400">{report.reportedBlocked ? "Blocked" : "Active"}</div>
                    </td>
                    <td className="px-4 py-2">{report.reporterId}</td>
                    <td className="px-4 py-2 max-w-lg">{report.reason}</td>
                    <td className="px-4 py-2">{report.timestamp?.seconds ? new Date(report.timestamp.seconds * 1000).toLocaleString() : "No date"}</td>
                    <td className="px-4 py-2">{report.status || "Pending"}</td>
                    <td className="px-4 py-2 flex gap-2 flex-wrap">
                      <button onClick={() => markReviewed(report.id)} className="bg-green-600 text-white px-2 py-1 rounded text-sm flex items-center gap-1"><FiCheck /> Mark Reviewed</button>
                      <button onClick={() => resolveReport(report.id)} className="bg-indigo-600 text-white px-2 py-1 rounded text-sm">Resolve</button>
                      <button onClick={() => deleteReport(report.id)} className="bg-red-600 text-white px-2 py-1 rounded text-sm"><FiTrash2 /> Delete</button>
                      <button onClick={() => blockUser(report.reportedId)} className="bg-yellow-500 text-black px-2 py-1 rounded text-sm"><FiSlash /> Block</button>
                      <div className="relative inline-block">
                        <select onChange={(e) => suspendUser(report.reportedId, Number(e.target.value))} defaultValue="">
                          <option value="">Suspend</option>
                          <option value="1">1 day</option>
                          <option value="7">7 days</option>
                          <option value="30">30 days</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
                {currentReports.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-500">No reports found.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          <div className="flex items-center justify-between mt-4">
            <div>
              <label>Per page: </label>
              <select value={reportsPerPage} onChange={(e) => setReportsPerPage(Number(e.target.value))} className="ml-2 p-1 rounded border">
                {[5,10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i+1} onClick={() => setCurrentPage(i+1)} className={`px-3 py-1 rounded ${currentPage === i+1 ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700"}`}>{i+1}</button>
              ))}
            </div>
          </div>
        </div>

        {/* chart */}
        <div className={`p-4 rounded-lg shadow ${isDark ? "bg-gray-800" : "bg-white"}`}>
          <h3 className="font-semibold mb-3">Report Status Distribution</h3>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {chartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* User modal */}
      {showUserModal && selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => { setShowUserModal(false); setSelectedUserId(null); }}
          isDark={isDark}
        />
      )}
    </div>
  );
}