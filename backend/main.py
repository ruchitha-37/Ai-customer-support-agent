import os
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional
import sqlite3
import shutil

# Local imports
from database import init_db, get_all_orders, DB_PATH
from agent import process_refund_request, get_logs, is_openai_configured

app = FastAPI(title="AI Refund Agent Backend")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
def startup_event():
    init_db()

class ChatRequest(BaseModel):
    message: str

class UpdateOrderRequest(BaseModel):
    name: str
    order_date: str
    product_name: str
    product_type: str
    amount: float
    is_damaged: int
    custom_made: int

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "openai_configured": is_openai_configured()
    }

@app.get("/api/orders")
def fetch_orders():
    try:
        orders = get_all_orders()
        return orders
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/orders/{customer_id}")
def update_order(customer_id: str, data: UpdateOrderRequest):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE orders
            SET name = ?, order_date = ?, product_name = ?, product_type = ?, amount = ?, is_damaged = ?, custom_made = ?
            WHERE customer_id = ?
        """, (data.name, data.order_date, data.product_name, data.product_type, data.amount, data.is_damaged, data.custom_made, customer_id))
        conn.commit()
        
        # Check if updated
        if cursor.rowcount == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="Order not found")
            
        conn.close()
        return {"status": "success", "message": f"Order {customer_id} updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
def chat_endpoint(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
        
    try:
        decision = process_refund_request(request.message)
        logs = get_logs()
        return {
            "decision": decision,
            "logs": logs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/speech-to-text")
async def speech_to_text(file: UploadFile = File(...)):
    if not is_openai_configured():
        return {
            "transcription": "",
            "error": "OpenAI API key not configured. Using browser speech recognition."
        }
        
    try:
        from openai import OpenAI
        client = OpenAI()
        
        # Save temp file
        temp_dir = os.path.join(os.path.dirname(__file__), "temp")
        os.makedirs(temp_dir, exist_ok=True)
        temp_filepath = os.path.join(temp_dir, file.filename)
        
        with open(temp_filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Call Whisper API
        with open(temp_filepath, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-1", 
                file=audio_file
            )
            
        # Clean up temp file
        os.remove(temp_filepath)
        
        return {
            "transcription": transcription.text,
            "error": None
        }
    except Exception as e:
        return {
            "transcription": "",
            "error": str(e)
        }

class TTSRequest(BaseModel):
    text: str

@app.post("/api/text-to-speech")
def text_to_speech(request: TTSRequest):
    if not is_openai_configured():
        return {
            "audio_url": "",
            "error": "OpenAI API key not configured. Using browser text-to-speech."
        }
        
    try:
        from openai import OpenAI
        client = OpenAI()
        
        # Call TTS API
        response = client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input=request.text
        )
        
        # Create temp folder inside backend
        temp_dir = os.path.join(os.path.dirname(__file__), "static")
        os.makedirs(temp_dir, exist_ok=True)
        output_filename = "response.mp3"
        output_filepath = os.path.join(temp_dir, output_filename)
        
        response.stream_to_file(output_filepath)
        
        # Return a relative URL (which the client will access)
        return {
            "audio_url": f"/static/{output_filename}",
            "error": None
        }
    except Exception as e:
        return {
            "audio_url": "",
            "error": str(e)
        }

# Mount static folder for serving synthesized voice responses
from fastapi.staticfiles import StaticFiles
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
