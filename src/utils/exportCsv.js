// src/utils/exportCsv.js
export function exportToCsv(filename = "reports.csv", rows = []) {
  if (!rows || !rows.length) {
    const csv = "";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    return;
  }

  const keys = Object.keys(rows[0]);
  const csvContent = [
    keys.join(","),
    ...rows.map((row) =>
      keys
        .map((k) => {
          const v = row[k] === null || row[k] === undefined ? "" : String(row[k]);
          // wrap fields with quotes and escape quotes
          return `"${v.replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}