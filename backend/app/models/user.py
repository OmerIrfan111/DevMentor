from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId
from typing import Annotated


class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = Field(min_length=1)


class UserInDB(BaseModel):
    id: str | None = None
    email: EmailStr
    name: str
    hashed_password: str

    class Config:
        populate_by_name = True


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
