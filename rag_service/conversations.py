import uuid
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException
from database import get_db

router = APIRouter(prefix="/api/conversations")

# ── Yardımcı: UUID üret ─────────────────────────
def make_uuid() -> str:
    return str(uuid.uuid4())

# ── Konuşma başlığı üret ───────────────────────────────
def make_title(first_message: str, max_len: int = 60) -> str:
    title = first_message.strip().replace("\n", " ")
    return title[:max_len] + "..." if len(title) > max_len else title

# ─────────────────────────────────────────────────────────────────────
# GET /api/conversations  →  Kullanıcının tüm konuşmaları
# ─────────────────────────────────────────────────────────────────────
@router.get("")
async def list_conversations(request: Request):
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Yetkisiz")
    
    db = get_db()
    rows = db.execute("""
        SELECT id, title, created_at, updated_at, message_count
        FROM conversations
        WHERE user_id = ?
        ORDER BY updated_at DESC
        LIMIT 100
    """, [user_id]).fetchall()
    db.close()

    return [dict(r) for r in rows]

# ─────────────────────────────────────────────────────────────────────
# POST /api/conversations  →  Yeni konuşma başlat
# ─────────────────────────────────────────────────────────────────────
@router.post("")
async def create_conversation(request: Request):
    body = await request.json()
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Yetkisiz")
        
    title = body.get("title", "Yeni Konuşma")
    db = get_db()

    conv_id = make_uuid()
    db.execute("""
        INSERT INTO conversations (id, user_id, title)
        VALUES (?, ?, ?)
    """, [conv_id, user_id, title])
    db.commit()
    db.close()

    return {"id": conv_id, "title": title}

# ─────────────────────────────────────────────────────────────────────
# GET /api/conversations/{id}/messages  →  Konuşma mesajları
# ─────────────────────────────────────────────────────────────────────
@router.get("/{conv_id}/messages")
async def get_messages(conv_id: str, request: Request):
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Yetkisiz")

    db = get_db()

    # Güvenlik: konuşma bu kullanıcıya mı ait?
    conv = db.execute(
        "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
        [conv_id, user_id]
    ).fetchone()

    if not conv:
        db.close()
        raise HTTPException(status_code=404, detail="Bulunamadı")

    rows = db.execute("""
        SELECT id, role, content, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC
    """, [conv_id]).fetchall()
    db.close()

    return [dict(r) for r in rows]

# ─────────────────────────────────────────────────────────────────────
# POST /api/conversations/{id}/messages  →  Mesaj kaydet
# ─────────────────────────────────────────────────────────────────────
@router.post("/{conv_id}/messages")
async def save_message(conv_id: str, request: Request):
    body = await request.json()
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Yetkisiz")

    role = body.get("role")    # "user" veya "assistant"
    content = body.get("content")
    db = get_db()

    msg_id = make_uuid()
    db.execute("""
        INSERT INTO messages (id, conversation_id, user_id, role, content)
        VALUES (?, ?, ?, ?, ?)
    """, [msg_id, conv_id, user_id, role, content])

    # Konuşmayı güncelle
    db.execute("""
        UPDATE conversations
        SET updated_at = CURRENT_TIMESTAMP,
            message_count = message_count + 1
        WHERE id = ?
    """, [conv_id])

    db.commit()
    db.close()
    return {"id": msg_id}

# ─────────────────────────────────────────────────────────────────────
# DELETE /api/conversations/{id}  →  Konuşmayı sil
# ─────────────────────────────────────────────────────────────────────
@router.delete("/{conv_id}")
async def delete_conversation(conv_id: str, request: Request):
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Yetkisiz")

    db = get_db()
    db.execute(
        "DELETE FROM conversations WHERE id = ? AND user_id = ?",
        [conv_id, user_id]
    )
    db.commit()
    db.close()
    return {"deleted": True}
