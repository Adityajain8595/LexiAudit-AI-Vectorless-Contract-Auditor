from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from supabase import Client
from app.core import get_supabase, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])

class AuthCredentials(BaseModel):
    email: EmailStr
    password: str

@router.post("/signup")
def signup(credentials: AuthCredentials, supabase: Client = Depends(get_supabase)):
    try:
        res = supabase.auth.sign_up({
            "email": credentials.email,
            "password": credentials.password
        })
        if not res.user:
            raise HTTPException(status_code=400, detail="Signup failed")
        
        token = res.session.access_token if res.session else None
        return {
            "message": "User signed up successfully",
            "user_id": res.user.id,
            "access_token": token,
            "token_type": "bearer"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
def login(credentials: AuthCredentials, supabase: Client = Depends(get_supabase)):
    try:
        res = supabase.auth.sign_in_with_password({
            "email": credentials.email,
            "password": credentials.password
        })
        if not res.session:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        
        return {
            "access_token": res.session.access_token,
            "token_type": "bearer",
            "user_id": res.user.id
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user