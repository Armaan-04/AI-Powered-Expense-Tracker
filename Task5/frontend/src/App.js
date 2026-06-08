import { useState, useEffect, useRef } from "react";

const API = "https://api.armaansfinancetracker.me"

export default function App() {

  const [expenses, setExpenses] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(null);
  const [error, setError] = useState("");
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

  useEffect(() => {
    fetchExpenses();
  }, []);

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

  return (
    <div style={{ padding: "30px", fontFamily: "Arial", maxWidth: "900px", margin: "0 auto" }}>
      <h1>AI Expense Tracker-Test</h1>
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