// src/components/AdminDashboard.jsx
import React, { useEffect, useState, useContext } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { FiUsers, FiAlertCircle, FiCheckCircle, FiTrash2, FiCheck, FiSlash, FiSearch } from "react-icons/fi";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export default function AdminDashboard() {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [reportsPerPage, setReportsPerPage] = useState(10);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "reports"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setReports(data);
      setFilteredReports(data);
    } catch (err) {
      console.error("Error fetching reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // ---------------- Filter & Search ----------------
  useEffect(() => {
    let temp = [...reports];

    if (statusFilter !== "All") {
      temp = temp.filter((r) => (r.status || "Pending") === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      temp = temp.filter(
        (r) =>
          (r.reportedName || r.reportedId).toLowerCase().includes(q) ||
          r.reporterId.toLowerCase().includes(q)
      );
    }

    setFilteredReports(temp);
    setCurrentPage(1); // Reset to first page on filter/search change
  }, [statusFilter, searchQuery, reports]);

  // Stats
  const totalReports = reports.length;
  const pendingReports = reports.filter((r) => !r.status || r.status === "Pending").length;
  const reviewedReports = reports.filter((r) => r.status === "Reviewed").length;
  const deletedReports = reports.filter((r) => r.status === "Deleted").length;

  const chartData = [
    { name: "Pending", value: pendingReports, color: "#f59e0b" },
    { name: "Reviewed", value: reviewedReports, color: "#10b981" },
    { name: "Deleted", value: deletedReports, color: "#ef4444" },
  ];

  // ---------------- Actions ----------------
  const markReviewed = async (reportId) => {
    await updateDoc(doc(db, "reports", reportId), { status: "Reviewed" });
    fetchReports();
  };

  const deleteReport = async (reportId) => {
    await deleteDoc(doc(db, "reports", reportId));
    fetchReports();
  };

  const blockUser = async (userId) => {
    await updateDoc(doc(db, "users", userId), { blocked: true });
    alert(`User ${userId} has been blocked.`);
  };

  if (loading)
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-gray-900 text-white" : "bg-gray-100 text-black"}`}>
        Loading dashboard...
      </div>
    );

  // ---------------- Pagination ----------------
  const indexOfLast = currentPage * reportsPerPage;
  const indexOfFirst = indexOfLast - reportsPerPage;
  const currentReports = filteredReports.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredReports.length / reportsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className={`min-h-screen p-6 ${isDark ? "bg-gray-900 text-white" : "bg-gray-100 text-black"}`}>
      <h1 className="text-3xl font-bold mb-6">🛠 LoeChat Admin Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
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
        <div className={`p-4 rounded-lg shadow ${isDark ? "bg-gray-800" : "bg-white"}`}>
          <div className="flex items-center gap-3">
            <FiUsers className="text-blue-500 text-2xl" />
            <div>
              <p className="text-sm text-gray-400">Total Reports</p>
              <p className="text-xl font-bold">{totalReports}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold mb-4">Report Status Distribution</h2>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select
          className="p-2 rounded border dark:bg-gray-700 dark:border-gray-600"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option>All</option>
          <option>Pending</option>
          <option>Reviewed</option>
          <option>Deleted</option>
        </select>

        <div className="flex items-center border rounded p-2 dark:bg-gray-700 dark:border-gray-600">
          <FiSearch className="mr-2" />
          <input
            type="text"
            placeholder="Search by user or reporter"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent outline-none text-sm w-full"
          />
        </div>
      </div>

      {/* Reports Table */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
        <table className="min-w-full">
          <thead className="bg-gray-200 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">Reported User</th>
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
                <td className="px-4 py-2">{report.reportedName || report.reportedId}</td>
                <td className="px-4 py-2">{report.reporterId}</td>
                <td className="px-4 py-2">{report.reason}</td>
                <td className="px-4 py-2">{new Date(report.timestamp?.seconds * 1000).toLocaleString()}</td>
                <td className="px-4 py-2">{report.status || "Pending"}</td>
                <td className="px-4 py-2 flex gap-2 flex-wrap">
                  <button
                    onClick={() => markReviewed(report.id)}
                    className="bg-green-600 text-white px-2 py-1 rounded flex items-center gap-1 text-sm"
                  >
                    <FiCheck /> Reviewed
                  </button>
                  <button
                    onClick={() => deleteReport(report.id)}
                    className="bg-red-600 text-white px-2 py-1 rounded flex items-center gap-1 text-sm"
                  >
                    <FiTrash2 /> Delete
                  </button>
                  <button
                    onClick={() => blockUser(report.reportedId)}
                    className="bg-yellow-500 text-black px-2 py-1 rounded flex items-center gap-1 text-sm"
                  >
                    <FiSlash /> Block User
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {currentReports.length === 0 && <p className="p-4 text-center text-gray-500">No reports found.</p>}
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-center gap-2 mt-4 flex-wrap">
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i + 1}
            onClick={() => paginate(i + 1)}
            className={`px-3 py-1 rounded ${
              currentPage === i + 1
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 dark:text-white"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}