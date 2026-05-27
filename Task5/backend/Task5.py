from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
import google.generativeai as genai
import json
import datetime
import base64
import os
from supabase import create_client, Client

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

# Configure Gemini using the official library
genai.configure(
    api_key=os.getenv("GEMINI_API_KEY"),
    transport="rest"
)

# Load Gemini 2.5 Flash model
model = genai.GenerativeModel("gemini-2.5-flash")

# Supabase Setup
SUPABASE_URL = os.getenv("SUPABASE_URL").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY").strip()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# Redirect root to docs
@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


# Scan Receipt - sends image to Gemini and returns extracted details
@app.post("/scan")
async def scan_receipt(file: UploadFile = File(...)):

    image_bytes = await file.read()
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
    image_type = file.content_type

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

    response = model.generate_content([
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
    ])

    raw_text = response.text.strip()

    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]

    extracted = json.loads(raw_text.strip())
    return extracted


# Add Expense - saves a confirmed expense to Supabase
@app.post("/expenses")
def add_expense(expense: dict):
    try:
        # Store items as JSON string in the items TEXT column
        items_json = json.dumps(expense.get("items", []))
        data = {
            "expense_date": expense.get("date"),
            "amount": expense.get("total_amount"),
            "description": expense.get("description"),
            "category": expense.get("category"),
            "items": items_json,
        }
        res = supabase.table("expenses").insert(data).execute()
        return {"message": "Expense saved successfully", "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Get All Expenses - returns all expenses from Supabase
@app.get("/expenses")
def get_expenses():
    try:
        res = supabase.table("expenses").select("*").order("created_at", desc=True).execute()
        expenses = res.data or []
        # Parse items JSON string back to list for each expense
        for expense in expenses:
            if isinstance(expense.get("items"), str):
                try:
                    expense["items"] = json.loads(expense["items"])
                except Exception:
                    expense["items"] = []
            elif expense.get("items") is None:
                expense["items"] = []
        return {"expenses": expenses}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Delete Expense - removes an expense from Supabase by ID
@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int):
    try:
        res = supabase.table("expenses").select("id").eq("id", expense_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Expense not found")
        supabase.table("expenses").delete().eq("id", expense_id).execute()
        return {"message": "Expense deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    