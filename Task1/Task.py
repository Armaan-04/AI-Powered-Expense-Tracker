from fastapi import FastAPI
from fastapi.responses import RedirectResponse

app = FastAPI()

message_store = {"message": "Hello World"}

@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")

@app.get("/message")
def get_message():
    return {"message": message_store["message"]}

@app.post("/message")
def update_message(new_message: str):
    message_store["message"] = new_message
    return {"message": message_store["message"]}