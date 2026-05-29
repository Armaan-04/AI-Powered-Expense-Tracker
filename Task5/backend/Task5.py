from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from google import genai
from google.genai import types
from supabase import create_client, Client
import json
import datetime
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gemini Setup - new google-genai client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
GEMINI_MODEL = "gemini-3.1-flash-lite"  

# Supabase Setup
SUPABASE_URL = os.getenv("SUPABASE_URL").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY").strip()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.post("/scan")
async def scan_receipt(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        image_type = file.content_type
        today = datetime.date.today().strftime("%Y-%m-%d")

        prompt = f"""
Look at this receipt or bill image carefully.
Extract all visible expense information.
Return ONLY valid JSON in this exact format:

{{
    "date": "YYYY-MM-DD",
    "items": [
        {{
            "name": "item name",
            "price": 0.00
        }}
    ],
    "total_amount": 0.00,
    "description": "store or restaurant name",
    "category": "Food"
}}

Rules:
- Use today's date ({today}) if no date is visible
- total_amount must always be a number, never null
- description should be the business/store name, never null
- category must be one of: Food, Travel, Shopping, Utilities, Health, Entertainment, Other
- Return ONLY raw JSON, no markdown, no explanation
"""

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_bytes(data=image_bytes, mime_type=image_type),
                        types.Part.from_text(text=prompt),
                    ]
                )
            ]
        )

        raw_text = response.text.strip()
        print("RAW GEMINI RESPONSE:", raw_text)

        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        raw_text = raw_text.strip()

        extracted = json.loads(raw_text)

        # Safety fallbacks
        extracted["date"] = extracted.get("date") or today
        extracted["items"] = extracted.get("items") or []
        extracted["total_amount"] = extracted.get("total_amount") or 0
        extracted["description"] = extracted.get("description") or "Unknown"
        extracted["category"] = extracted.get("category") or "Other"

        return extracted

    except Exception as e:
        print("SCAN ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/expenses")
def add_expense(expense: dict):
    try:
        data = {
            "expense_date": expense.get("date"),
            "amount": expense.get("total_amount"),
            "description": expense.get("description"),
            "category": expense.get("category"),
            "items": json.dumps(expense.get("items") or []),
        }
        response = supabase.table("expenses").insert(data).execute()
        return {"message": "Expense saved successfully", "data": response.data}
    except Exception as e:
        print("SAVE ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/expenses")
def get_expenses():
    try:
        response = supabase.table("expenses").select("*").order("created_at", desc=True).execute()
        expenses = response.data or []
        for expense in expenses:
            if isinstance(expense.get("items"), str):
                try:
                    expense["items"] = json.loads(expense["items"])
                except Exception:
                    expense["items"] = []
            elif not isinstance(expense.get("items"), list):
                expense["items"] = []
        return {"expenses": expenses}
    except Exception as e:
        print("FETCH ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int):
    try:
        existing = supabase.table("expenses").select("id").eq("id", expense_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Expense not found")
        supabase.table("expenses").delete().eq("id", expense_id).execute()
        return {"message": "Expense deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print("DELETE ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))