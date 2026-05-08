import { useState, useEffect } from "react";

const API = "http://127.0.0.1:8000";

export default function App() {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [editNote, setEditNote] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const [deleteNote, setDeleteNote] = useState(null);

  // Fetch all notes
  const fetchNotes = async () => {
    const res = await fetch(`${API}/get-notes`);
    const data = await res.json();
    setNotes(data.notes);
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  // Create note
  const createNote = async () => {
    if (!title || !content) return;
    await fetch(`${API}/create-notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    setTitle("");
    setContent("");
    fetchNotes();
  };

  // Update note
  const updateNote = async () => {
    await fetch(`${API}/update-notes/${editNote.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, content: editContent }),
    });
    setEditNote(null);
    fetchNotes();
  };

  // Delete note
  const deleteNoteConfirm = async () => {
    await fetch(`${API}/delete-notes/${deleteNote.id}`, { method: "DELETE" });
    setDeleteNote(null);
    fetchNotes();
  };

  return (
    <div style={{ padding: "30px", fontFamily: "Arial", maxWidth: "800px", margin: "0 auto" }}>
      <h1>To-Do Notes</h1>

      {/* Create Note */}
      <div style={{ marginBottom: "30px" }}>
        <h3>Add New Note</h3>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ display: "block", marginBottom: "8px", padding: "8px", width: "100%" }}
        />
        <textarea
          placeholder="Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ display: "block", marginBottom: "8px", padding: "8px", width: "100%", height: "80px" }}
        />
        <button onClick={createNote}>Add Note</button>
      </div>

      {/* Notes Table */}
      <h3>All Notes</h3>
      <table border="1" cellPadding="10" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th>ID</th>
            <th>Title</th>
            <th>Content</th>
            <th>Updated At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((note) => (
            <tr key={note.id}>
              <td>{note.id}</td>
              <td>{note.title}</td>
              <td>{note.content}</td>
              <td>{note.updated_at}</td>
              <td>
                <button onClick={() => { setEditNote(note); setEditTitle(note.title); setEditContent(note.content); }}>
                  Edit
                </button>
                <button onClick={() => setDeleteNote(note)} style={{ marginLeft: "8px", color: "red" }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Edit Popup */}
      {editNote && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: "24px", borderRadius: "8px", width: "400px" }}>
            <h3>Edit Note</h3>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              style={{ display: "block", marginBottom: "8px", padding: "8px", width: "100%" }}
            />
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              style={{ display: "block", marginBottom: "8px", padding: "8px", width: "100%", height: "80px" }}
            />
            <button onClick={updateNote}>Update</button>
            <button onClick={() => setEditNote(null)} style={{ marginLeft: "8px" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Delete Popup */}
      {deleteNote && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: "24px", borderRadius: "8px", width: "400px" }}>
            <h3>Are you sure?</h3>
            <p>Delete note: <strong>"{deleteNote.title}"</strong>?</p>
            <button onClick={deleteNoteConfirm} style={{ color: "red" }}>Delete</button>
            <button onClick={() => setDeleteNote(null)} style={{ marginLeft: "8px" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
