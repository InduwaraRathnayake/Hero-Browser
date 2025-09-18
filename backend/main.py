from fastapi import FastAPI
from pydantic import BaseModel
import httpx
import os
from fastapi.middleware.cors import CORSMiddleware
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

API_KEY = os.getenv("GEMINI_API_KEY")  # Now it will find the key from .env

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExplainRequest(BaseModel):
    text: str

@app.post("/explain")
async def explain(request: ExplainRequest):
    print("api key:", API_KEY)
    if not API_KEY:
        print("WARNING: GEMINI_API_KEY is not set")
        return {"explanation": "API key is not configured", "error": True}
    
    input_text = request.text
    print("Received input:", input_text[:100] + "..." if len(input_text) > 100 else input_text)
    
    # Check if it's a question about a context
    if input_text.startswith("Question:") and "Context:" in input_text:
        print("Processing as question with context")
        prompt = f"""
        {input_text}
        
        Based on the provided context, please answer the question concisely and accurately.
        If the context doesn't contain enough information to answer the question,
        please indicate that clearly.
        """
    else:
        print("Processing as regular explanation")
        # Regular explanation
        prompt = f"""
        Please explain the following text in a clear and concise way:
        
        {input_text}
        """
    
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={API_KEY}"
    
    payload = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ]
    }

    print("Payload:", payload)  # Debugging log

    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(url, json=payload)
            data = r.json()
            # print("Full API response:", json.dumps(data, indent=2))  # Print the full response
            
            if "error" in data:
                return {"explanation": f"API Error: {data.get('error', {}).get('message', 'Unknown error')}", "error": True}
                
            explanation = (
                data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "No explanation available")
            )
            
            print("Explanation:", explanation)  # Debugging log
            return {"explanation": explanation}
            
        except Exception as e:
            print(f"Exception occurred: {str(e)}")
            return {"explanation": f"An error occurred: {str(e)}", "error": True}
