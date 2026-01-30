from pydantic import BaseModel, field_validator
from typing import Optional
import re

class UserBase(BaseModel):
    username: str
    email: str
    full_name: Optional[str] = None
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        # Accepter les emails standards et les domaines .local
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, v):
            raise ValueError('Email invalide')
        return v

class UserCreate(UserBase):
    password: str
    role: str = 'ADMIN'
    staff_type: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(UserBase):
    id: str
    role: str
    staff_type: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
