import { useState, useEffect } from "react";

const API = "http://127.0.0.1:8000";

export default function App() {

  // State
  const [expenses, setExpenses] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(null);

  // Fetch all expenses from backend
  const fetchExpenses = async () => {
    const res = await fetch(API + "/expenses");
    const data = await res.json();
    setExpenses(data.expenses);
  };

  // Fetch expenses when app loads
  useEffect(() => {
    fetchExpenses();
  }, []);

  // Scan receipt - sends image to backend which sends it to Gemini
  const scanReceipt = async () => {
    if (!selectedFile) return;
    setScanning(true);
    setScanned(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    const res = await fetch(API + "/scan", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setScanned(data);
    setScanning(false);
  };

  // Save confirmed expense to database
  const saveExpense = async () => {
    await fetch(API + "/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scanned),
    });
    setScanned(null);
    setSelectedFile(null);
    fetchExpenses();
  };

  // Delete expense from database
  const deleteExpense = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    await fetch(API + "/expenses/" + id, { method: "DELETE" });
    fetchExpenses();
  };

  return (
    <div style={{ padding: "30px", fontFamily: "Arial", maxWidth: "900px", margin: "0 auto" }}>
      <h1>AI Expense Tracker</h1>
      <p style={{ color: "gray" }}>Upload a receipt and let AI extract the details</p>

      {/* Upload Section */}
      <div style={{ padding: "20px", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "30px" }}>
        <h3>Scan Receipt</h3>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => { setSelectedFile(e.target.files[0]); setScanned(null); }}
          style={{ display: "block", marginBottom: "10px" }}
        />
        {selectedFile && (
          <div>
            {/* Show image preview */}
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

      {/* Scanned Result - shown after Gemini extracts details */}
      {scanned && (
        <div style={{ padding: "20px", border: "1px solid #aaa", borderRadius: "8px", marginBottom: "30px", background: "#f9f9f9" }}>
          <h3>Extracted Details</h3>

          <p><strong>Date:</strong> {scanned.date || "Not found"}</p>

          {/* Show individual items */}
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
          <button onClick={() => setScanned(null)} style={{ padding: "8px 20px", cursor: "pointer", color: "red" }}>
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
                <td>{expense.date}</td>
                <td>
                  {/* Show items list */}
                  {expense.items && expense.items.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: "16px" }}>
                      {expense.items.map((item, index) => (
                        <li key={index}>{item.name} — ₹{item.price}</li>
                      ))}
                    </ul>
                  ) : "-"}
                </td>
                <td>₹{expense.total_amount}</td>
                <td>{expense.description}</td>
                <td>{expense.category}</td>
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