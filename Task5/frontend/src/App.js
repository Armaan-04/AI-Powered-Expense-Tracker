import { useState, useEffect, useRef } from "react";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";

const API = "https://api.armaansfinancetracker.me"

export default function App() {

  const [expenses, setExpenses] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(null);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const fileInputRef = useRef();

  // Fetch all expenses from backend
  const fetchExpenses = async () => {
    setError("");
    try {
      const res = await fetch(API + "/expenses");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setExpenses([]);
      } else {
        setExpenses(data.expenses || []);
      }
    } catch (err) {
      setError("Failed to fetch expenses");
      setExpenses([]);
    }
  };

  const fetchDashboard = async (year = "", month = "") => {
  try {
    let url = API + "/dashboard";

    const params = [];

    if (year) params.push(`year=${year}`);
    if (month) params.push(`month=${month}`);

    if (params.length) {
      url += "?" + params.join("&");
    }

    const res = await fetch(url);
    const data = await res.json();

    setDashboard(data);
    } catch (err) {
    console.error(err);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchDashboard();
  },  []);

  useEffect(() => {
  fetchDashboard(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Scan receipt
  const scanReceipt = async () => {
    if (!selectedFile) return;
    setScanning(true);
    setScanned(null);
    setError("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch(API + "/scan", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setScanned(null);
      } else {
        setScanned(data);
      }
    } catch (err) {
      setError("Failed to scan receipt");
      setScanned(null);
    }
    setScanning(false);
  };

  // Save confirmed expense
  const saveExpense = async () => {
    setError("");
    try {
      const res = await fetch(API + "/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scanned),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setScanned(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchExpenses();
    } catch (err) {
      setError("Failed to save expense");
    }
  };

  // Delete expense
  const deleteExpense = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    setError("");
    try {
      const res = await fetch(API + "/expenses/" + id, { method: "DELETE" });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        fetchExpenses();
      }
    } catch (err) {
      setError("Failed to delete expense");
    }
  };

  const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#A855F7",
  "#EF4444",
  "#10B981"
];

  return (
    <div style={{ padding: "30px", fontFamily: "Arial", maxWidth: "900px", margin: "0 auto" }}>
      <h1>AI Expense Tracker - test</h1>
      <p style={{ color: "gray" }}>Upload a receipt and let AI extract the details</p>
      {error && (
        <div style={{ color: "red", marginBottom: "16px" }}>{error}</div>
      )}

      {/* Upload Section */}
      <div style={{ padding: "20px", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "30px" }}>
        <h3>Scan Receipt</h3>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={(e) => { setSelectedFile(e.target.files[0]); setScanned(null); }}
            style={{ display: "block", marginBottom: "10px" }}
          />
        {selectedFile && (
          <div>
            <img
              src={URL.createObjectURL(selectedFile)}
              alt="receipt preview"
              style={{ maxWidth: "200px", maxHeight: "200px", marginBottom: "10px", display: "block" }}
            />
            <button onClick={scanReceipt} disabled={scanning} style={{ padding: "8px 20px", cursor: "pointer" }}>
              {scanning ? "Scanning..." : "Scan Receipt"}
            </button>
          </div>
        )}
      </div>

      {/* Scanned Result */}
      {scanned && (
        <div style={{ padding: "20px", border: "1px solid #aaa", borderRadius: "8px", marginBottom: "30px", background: "#f9f9f9" }}>
          <h3>Extracted Details</h3>
          <p><strong>Date:</strong> {scanned.date || "Not found"}</p>
          {scanned.items && scanned.items.length > 0 && (
            <div>
              <strong>Items:</strong>
              <ul>
                {scanned.items.map((item, index) => (
                  <li key={index}>{item.name} — ₹{item.price}</li>
                ))}
              </ul>
            </div>
          )}
          <p><strong>Total Amount:</strong> ₹{scanned.total_amount || "Not found"}</p>
          <p><strong>Description:</strong> {scanned.description || "Not found"}</p>
          <p><strong>Category:</strong> {scanned.category || "Other"}</p>
          <button onClick={saveExpense} style={{ padding: "8px 20px", cursor: "pointer", marginRight: "10px" }}>
            Save Expense
          </button>
          <button
            onClick={() => {
              setScanned(null);
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            style={{ padding: "8px 20px", cursor: "pointer", color: "red" }}
          >
            Discard
          </button>
        </div>
      )}

      {dashboard && (
  <div
    style={{
      marginBottom: "40px",
      padding: "20px",
      border: "1px solid #ddd",
      borderRadius: "8px"
    }}
  >
    <h2>Expense Dashboard</h2>

    <div
      style={{
        display: "flex",
        gap: "15px",
        marginBottom: "20px"
      }}
    >
      <select
        value={selectedYear}
        onChange={(e) => {
          setSelectedYear(e.target.value);
          setSelectedMonth("");
        }}
      >
        <option value="">All Years</option>

        {dashboard.years?.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>

      <select
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(e.target.value)}
      >
        <option value="">All Months</option>

        {dashboard.months?.map((month) => (
          <option key={month} value={month}>
            {new Date(2000, month - 1)
              .toLocaleString("default", { month: "long" })}
          </option>
        ))}
      </select>
    </div>

    <div
      style={{
        display: "flex",
        gap: "30px",
        marginBottom: "25px"
      }}
    >
      <div>
        <strong>Total Spend</strong>
        <div>₹{dashboard.total_amount}</div>
      </div>

      <div>
        <strong>Expenses</strong>
        <div>{dashboard.expense_count}</div>
      </div>
    </div>

    <div
      style={{
        display: "flex",
        gap: "30px",
        flexWrap: "wrap"
      }}
    >
      <div style={{ width: "450px", height: "350px" }}>
        <h4>Category Percentage Breakdown</h4>

        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dashboard.categories}
              dataKey="percentage"
              nameKey="category"
              label={(entry) =>
                `${entry.category} (${entry.percentage}%)`
              }
            >
              {dashboard.categories.map((entry, index) => (
                <Cell
                  key={index}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>

            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div style={{ width: "550px", height: "350px" }}>
        <h4>Category Amount Breakdown</h4>

        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dashboard.categories}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip />
            <Legend />

            <Bar dataKey="amount" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
)}

      {/* Expenses Table */}
      <h3>Saved Expenses ({expenses.length})</h3>
      {expenses.length === 0 ? (
        <p style={{ color: "gray" }}>No expenses saved yet.</p>
      ) : (
        <table border="1" cellPadding="10" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f0f0f0" }}>
              <th>Date</th>
              <th>Items</th>
              <th>Total</th>
              <th>Description</th>
              <th>Category</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td>{expense.expense_date}</td>
                <td>
                  {/* Show items breakdown */}
                  {expense.items && expense.items.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: "16px" }}>
                      {expense.items.map((item, index) => (
                        <li key={index}>{item.name} — ₹{item.price}</li>
                      ))}
                    </ul>
                  ) : "-"}
                </td>
                <td>₹{expense.amount}</td>
                <td>{expense.description}</td>
                <td>{expense.category}</td>
                {/* Source column removed */}
                <td>
                  <button onClick={() => deleteExpense(expense.id)} style={{ color: "red", cursor: "pointer" }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}