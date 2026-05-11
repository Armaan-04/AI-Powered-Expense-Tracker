import { useState, useEffect } from "react";

const API = "http://127.0.0.1:8000";

//chunk size for chunk uploading - 100KB per chunk
const CHUNK_SIZE = 100 * 1024;

export default function App() {
  
  // state management for files, upload status and progress
  const [files, setFiles] = useState([]);
 
  const [selectedFile, setSelectedFile] = useState(null);

  const [uploading, setUploading] = useState(false);
  
  const [progress, setProgress] = useState(0);

   // fetch uploaded files from backend
  const fetchFiles = async () => {
    const res = await fetch(API + "/files");
    const data = await res.json();
    setFiles(data.files);
  };
 
   // automatically fetch files when app loads
  useEffect(() => {
    
    fetchFiles();
    
    const interval = setInterval(fetchFiles, 2000);

    return () => clearInterval(interval);
  }, []);

  // upload selected file in chunks
  const uploadFile = async () => {
   
    if (!selectedFile) return;

    setUploading(true);
    setProgress(0);
    
    //Calculating , sending and uploading chunks to backend
    const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
   
    const fileId = Date.now().toString();
   
    for (let i = 0; i < totalChunks; i++) {
      
      const start = i * CHUNK_SIZE;

      const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
  
      const chunk = selectedFile.slice(start, end);
 
      const formData = new FormData();

      formData.append("file", chunk, selectedFile.name);
      formData.append("chunk_index", i);
      formData.append("total_chunks", totalChunks);
      formData.append("file_id", fileId);
      formData.append("filename", selectedFile.name);
 
      await fetch(API + "/upload/chunk", {
        method: "POST",
        body: formData,
      });
  
      //update upload progress percentage
      setProgress(Math.round(((i + 1) / totalChunks) * 100));
    }
    //reset upload state after completion
    setUploading(false);
    setSelectedFile(null);
    setProgress(0);
 
    fetchFiles();
  };

  //Deletion
  const deleteFile = async (filename) => {
  
    if (!window.confirm("Delete " + filename + "?")) return;

    await fetch(API + "/files/" + filename + "/delete", { method: "DELETE" });
 
    fetchFiles();
  };

  //frontend UI
  return (
    <div style={{ padding: "30px", fontFamily: "Arial", maxWidth: "900px", margin: "0 auto" }}>
      <h1>File Upload Manager</h1>
      <p style={{ color: "gray" }}>AI Powered Expense Tracker - Task 4</p>
   
      <div style={{ marginBottom: "30px", padding: "20px", border: "1px solid #ddd", borderRadius: "8px" }}>
        <h3>Upload Image</h3>

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setSelectedFile(e.target.files[0])}
          style={{ display: "block", marginBottom: "10px" }}
        />
    
        {selectedFile && (
          <p style={{ color: "gray", fontSize: "13px" }}>
            Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
          </p>
        )}
      
        <button
          onClick={uploadFile}
          disabled={!selectedFile || uploading}
          style={{ padding: "8px 20px", cursor: "pointer" }}
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
       
        {uploading && (
          <div style={{ marginTop: "12px" }}>
            <p style={{ margin: "0 0 4px 0", fontSize: "13px" }}>
              Uploading chunks... {progress}%
            </p>
           
            <div style={{ background: "#eee", borderRadius: "4px", height: "10px", width: "100%" }}>
           
              <div style={{
                background: "green",
                height: "10px",
                borderRadius: "4px",
                width: progress + "%",
                transition: "width 0.3s"
              }} />
            </div>
          </div>
        )}
      </div>
   
      <h3>Uploaded Files ({files.length})</h3>
   
      {files.length === 0 ? (
        <p style={{ color: "gray" }}>No files uploaded yet.</p>
      ) : (
        <table border="1" cellPadding="10" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f0f0f0" }}>
              <th>Filename</th>
              <th>Size</th>
              <th>Uploaded At</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
        
            {files.map((file) => (
              <tr key={file.id}>
                <td>{file.filename}</td>
              
                <td>{file.size > 0 ? (file.size / 1024).toFixed(2) + " KB" : "-"}</td>

                <td>{file.uploaded_at}</td>
              
                <td style={{ color: file.status === "done" ? "green" : "orange" }}>
                  {file.status}
                </td>

                <td>
                 
                  <a
                    href={API + "/files/" + file.filename + "/view"}
                    target="_blank"
                    rel="noreferrer"
                    style={{ marginRight: "8px" }}
                  >
                    Open
                  </a>
          
                  <a
                    href={API + "/files/" + file.filename + "/download"}
                    style={{ marginRight: "8px" }}
                  >
                    Download
                  </a>
              
                  <button
                    onClick={() => deleteFile(file.filename)}
                    style={{ color: "red", cursor: "pointer" }}
                  >
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