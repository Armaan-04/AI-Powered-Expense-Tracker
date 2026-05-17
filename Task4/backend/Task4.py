from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, FileResponse
import os
import shutil
import datetime

app = FastAPI()

# Allow React on port 3000 to talk to FastAPI on port 8000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Folder where uploaded images will be saved
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# In-memory list to track uploaded files
files_db = []


#Background Job
def assemble_chunks(file_id, filename, chunks_dir):
   
    try:
        # update status to processing
        for file in files_db:
            if file["id"] == file_id:
                file["status"] = "processing"

        # get all chunk files sorted by name so they assemble in correct order
        chunk_files = sorted(os.listdir(chunks_dir))

        # path where the final assembled file will be saved
        final_path = os.path.join(UPLOAD_DIR, filename)

        # open final file and write all chunks into it one by one
        with open(final_path, "wb") as final_file:
            for chunk_file in chunk_files:
                chunk_path = os.path.join(chunks_dir, chunk_file)
                with open(chunk_path, "rb") as cf:
                    final_file.write(cf.read())

        # delete temp chunks folder since we no longer need it
        shutil.rmtree(chunks_dir)

        # update status to done and save final file size
        for file in files_db:
            if file["id"] == file_id:
                file["status"] = "done"
                file["size"] = os.path.getsize(final_path)

        print(f"File {filename} assembled successfully!")

    except Exception as e:
        print(f"Assembly failed for {filename}: {e}")
        for file in files_db:
            if file["id"] == file_id:
                file["status"] = "failed"


# Routes 

# Redirect root to docs
@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


#  Upload chunk 
@app.post("/upload/chunk")
async def upload_chunk(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    file_id: str = Form(...),
    filename: str = Form(...)
):
    # create temp folder for this file's chunks
    chunks_dir = os.path.join(UPLOAD_DIR, "temp_" + file_id)
    os.makedirs(chunks_dir, exist_ok=True)

    # save this chunk to the temp folder
    # chunks are named chunk_0000, chunk_0001 etc so they sort correctly
    chunk_path = os.path.join(chunks_dir, "chunk_" + str(chunk_index).zfill(4))
    with open(chunk_path, "wb") as f:
        content = await file.read()
        f.write(content)

    print(f"Received chunk {chunk_index + 1} of {total_chunks} for {filename}")

    # if this is the first chunk, add file to tracking list
    if chunk_index == 0:
        files_db.append({
            "id": file_id,
            "filename": filename,
            "uploaded_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "uploading",
            "size": 0
        })

    # if this is the last chunk, trigger background assembly
    if chunk_index == total_chunks - 1:
        background_tasks.add_task(assemble_chunks, file_id, filename, chunks_dir)

    return {
        "message": "Chunk " + str(chunk_index + 1) + " of " + str(total_chunks) + " received",
        "file_id": file_id
    }


# Get all files 
@app.get("/files")
def get_files():
    return {"files": files_db}


# View file in browser 
@app.get("/files/{filename}/view")
def view_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        return {"error": "File not found"}
    return FileResponse(file_path)


# Download file 
@app.get("/files/{filename}/download")
def download_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        return {"error": "File not found"}
    return FileResponse(
        file_path,
        headers={"Content-Disposition": "attachment; filename=" + filename}
    )


# Delete file 
@app.delete("/files/{filename}/delete")
def delete_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        return {"error": "File not found"}
    os.remove(file_path)
    global files_db
    files_db = [f for f in files_db if f["filename"] != filename]
    return {"message": "File deleted successfully"}