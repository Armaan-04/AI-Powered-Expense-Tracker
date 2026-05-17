from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
import requests
import json
import datetime
import base64
import os
import sqlite3

app = FastAPI()

# Allow React on port 3000 to talk to FastAPI on port 8000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load API key from .env file
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Gemini API URL using REST
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY


# ── Database Setup ─────────────────────────────────────────────────────────────
def get_db():
    # connects to the SQLite database file
    conn = sqlite3.connect("expenses.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    # creates the expenses table if it doesn't exist
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            date        TEXT,
            items       TEXT,
            total_amount REAL,
            description TEXT,
            category    TEXT,
            created_at  TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

# run on server start
init_db()


# Redirect root to docs
@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


# Scan Receipt - sends image to Gemini and returns extracted details
@app.post("/scan")
async def scan_receipt(file: UploadFile = File(...)):

    # read the uploaded image file as bytes
    image_bytes = await file.read()

    # convert image bytes to base64 so Gemini can read it
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    # get the image type (jpeg, png etc)
    image_type = file.content_type

    # prompt sent to Gemini along with the image
    prompt = """
    Look at this receipt or bill image and extract the expense details.
    Return ONLY a JSON object with these exact fields:
    {
        "date": <date in YYYY-MM-DD format>,
        "items": [
            {"name": <item name>, "price": <item price as number>},
            {"name": <item name>, "price": <item price as number>}
        ],
        "total_amount": <total amount as number>,
        "description": <short description of where this was purchased>,
        "category": <one of: Food, Travel, Shopping, Utilities, Health, Entertainment, Other>
    }
    If any field is not visible in the image use null.
    If no individual items are visible return an empty list for items.
    Today's date is """ + datetime.date.today().strftime("%Y-%m-%d") + """.
    Return ONLY the JSON, no extra text.
    """

    # build the request body for Gemini REST API
    request_body = {
        "contents": [
            {
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": image_type,
                            "data": image_base64
                        }
                    },
                    {
                        "text": prompt
                    }
                ]
            }
        ]
    }

    # send HTTP POST request to Gemini API
    response = requests.post(GEMINI_URL, json=request_body)

    # check if request was successful
    if response.status_code != 200:
        return {"error": "Gemini API error: " + response.text}

    # extract the text response from Gemini
    raw_text = response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()

    # remove markdown code blocks if Gemini wraps the JSON in them
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]

    # parse and return the JSON response
    extracted = json.loads(raw_text.strip())
    return extracted


# Add Expense - saves a confirmed expense to SQLite database
@app.post("/expenses")
def add_expense(expense: dict):
    conn = get_db()

    # convert items list to JSON string for storage
    items_json = json.dumps(expense.get("items", []))

    conn.execute(
        "INSERT INTO expenses (date, items, total_amount, description, category) VALUES (?, ?, ?, ?, ?)",
        (
            expense.get("date"),
            items_json,
            expense.get("total_amount"),
            expense.get("description"),
            expense.get("category")
        )
    )
    conn.commit()
    conn.close()
    return {"message": "Expense saved successfully"}


# Get All Expenses - returns all expenses from SQLite database
@app.get("/expenses")
def get_expenses():
    conn = get_db()
    rows = conn.execute("SELECT * FROM expenses ORDER BY created_at DESC").fetchall()
    conn.close()

    expenses = []
    for row in rows:
        expense = dict(row)
        # convert items JSON string back to a list
        expense["items"] = json.loads(expense["items"])
        expenses.append(expense)

    return {"expenses": expenses}


# Delete Expense - removes an expense from the database by ID
@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int):
    conn = get_db()
    existing = conn.execute("SELECT * FROM expenses WHERE id = ?", (expense_id,)).fetchone()
    if not existing:
        conn.close()
        return {"error": "Expense not found"}
    conn.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
    conn.commit()
    conn.close()
    return {"message": "Expense deleted successfully"}