import os
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
ALLOWED = [o.strip() for o in os.getenv("ALLOWED_ORIGINS","*").split(",")]
API_KEY = os.getenv("API_KEY")

engine = create_engine(DATABASE_URL, future=True, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

app = FastAPI(title="Conductor API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if ALLOWED == ["*"] else ALLOWED,
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# Simple API key auth
@app.middleware("http")
async def api_key_guard(request: Request, call_next):
    if API_KEY and request.headers.get("x-api-key") != API_KEY:
        return fastapi.responses.JSONResponse({"error": "unauthorized"}, status_code=401)
    return await call_next(request)

# Schemas
class UserIn(BaseModel):
    name: str
    email: EmailStr

class UserOut(UserIn):
    id: int

@app.get("/health")
def health(): return {"ok": True}

@app.get("/users", response_model=list[UserOut])
def list_users():
    with SessionLocal() as s:
        rows = s.execute(text("SELECT id, name, email FROM users ORDER BY id")).mappings().all()
        return rows

@app.post("/users", response_model=UserOut, status_code=201)
def create_user(body: UserIn):
    with SessionLocal() as s:
        try:
            row = s.execute(
                text("INSERT INTO users(name,email) VALUES (:n,:e) RETURNING id, name, email"),
                {"n": body.name, "e": body.email}
            ).mappings().one()
            s.commit()
            return row
        except Exception as e:
            s.rollback()
            raise HTTPException(400, f"insert failed: {e}")

@app.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: int):
    with SessionLocal() as s:
        row = s.execute(text("SELECT id, name, email FROM users WHERE id=:id"), {"id": user_id}).mappings().first()
        if not row: raise HTTPException(404, "not found")
        return row

@app.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UserIn):
    with SessionLocal() as s:
        row = s.execute(
            text("""UPDATE users SET name=:n, email=:e WHERE id=:id
                    RETURNING id, name, email"""),
            {"id": user_id, "n": body.name, "e": body.email}
        ).mappings().first()
        if not row: raise HTTPException(404, "not found")
        s.commit()
        return row

@app.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int):
    with SessionLocal() as s:
        res = s.execute(text("DELETE FROM users WHERE id=:id"), {"id": user_id})
        if res.rowcount == 0: raise HTTPException(404, "not found")
        s.commit()
        return