import time
from fastapi import Header, HTTPException, Depends
from supabase import Client
from .database import get_supabase

async def get_current_user(authorization: str = Header(None), supabase: Client = Depends(get_supabase)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authentication token")
    
    token = authorization.split(" ")[1]
    
    last_err = None
    for attempt in range(3):
        try:
            user_response = supabase.auth.get_user(token)
            if not user_response or not user_response.user:
                raise HTTPException(status_code=401, detail="Invalid session or user not found")
            
            return {
                "id": user_response.user.id,
                "email": user_response.user.email,
                "user_metadata": user_response.user.user_metadata or {}
            }
        except Exception as e:
            last_err = e
            err_str = str(e).lower()
            if ("jwt issued at future" in err_str or "pgrst303" in err_str) and attempt < 2:
                time.sleep(1.0 * (attempt + 1))
                continue
            break

    raise HTTPException(status_code=401, detail=f"Authentication failed: {str(last_err)}")
