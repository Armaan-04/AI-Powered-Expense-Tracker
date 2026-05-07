from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import sqlite3
import datetime

app = FastAPI()

# Database setup
def get_db():
    conn = sqlite3.connect("todo.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            content     TEXT NOT NULL,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

init_db()

# Request model
class NoteRequest(BaseModel):
    title: str
    content: str

# Routes
@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")

@app.get("/get-notes")
def get_notes():
    conn = get_db()
    notes = conn.execute("""
        SELECT * FROM notes 
        ORDER BY updated_at DESC
    """).fetchall()
    conn.close()
    return {"notes": [dict(note) for note in notes]}

@app.put("/create-notes")
def create_note(note: NoteRequest):
    conn = get_db()
    conn.execute(
        "INSERT INTO notes (title, content) VALUES (?, ?)",
        (note.title, note.content)
    )
    conn.commit()
    conn.close()
    return {"message": "Note created successfully"}

@app.post("/update-notes/{note_id}")
def update_note(note_id: int, note: NoteRequest):
    conn = get_db()
    existing = conn.execute(
        "SELECT * FROM notes WHERE id = ?", (note_id,)
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")
    conn.execute(
        "UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?",
        (note.title, note.content, datetime.datetime.now(), note_id)
    )
    conn.commit()
    conn.close()
    return {"message": "Note updated successfully"}

@app.delete("/delete-notes/{note_id}")
def delete_note(note_id: int):
    conn = get_db()
    existing = conn.execute(
        "SELECT * FROM notes WHERE id = ?", (note_id,)
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")
    conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    conn.commit()
    conn.close()
    return {"message": "Note deleted successfully"}