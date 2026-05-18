from __future__ import annotations

import json
import os
import re
import secrets
import threading
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


BASE_DIR = Path(__file__).resolve().parent
APP_DIR = Path(os.getenv("GPX_APP_DIR", BASE_DIR / "app"))
UPLOAD_DIR = Path(os.getenv("GPX_UPLOAD_DIR", BASE_DIR / "gpx-files"))
INDEX_PATH = Path(os.getenv("GPX_INDEX_PATH", UPLOAD_DIR / "gpx-index.json"))
MAX_UPLOAD_BYTES = int(os.getenv("GPX_MAX_UPLOAD_BYTES", 10 * 1024 * 1024))
OWNER_COOKIE_NAME = "gpxv_owner"
OWNER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5

PUBLIC_ROOT_FILES = {
    "index.html",
    "style.css",
    "script.js",
    "manifest.json",
    "service-worker.js",
    "icon.svg",
}

DEFAULT_INDEX = {
    "files_by_id": {},
    "filename_to_id": {},
}

_index_lock = threading.Lock()

app = FastAPI(title="Topo GPX Viewer Backend")
app.mount("/lang", StaticFiles(directory=APP_DIR / "lang"), name="lang")


def ensure_storage_dirs() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def load_index() -> dict[str, Any]:
    if not INDEX_PATH.exists():
        return {
            "files_by_id": {},
            "filename_to_id": {},
        }

    try:
        with INDEX_PATH.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return {
            "files_by_id": {},
            "filename_to_id": {},
        }

    files_by_id = payload.get("files_by_id")
    filename_to_id = payload.get("filename_to_id")
    if not isinstance(files_by_id, dict) or not isinstance(filename_to_id, dict):
        return {
            "files_by_id": {},
            "filename_to_id": {},
        }

    return {
        "files_by_id": files_by_id,
        "filename_to_id": filename_to_id,
    }


def save_index(index_payload: dict[str, Any]) -> None:
    ensure_storage_dirs()
    temp_path = INDEX_PATH.with_suffix(".tmp")
    with temp_path.open("w", encoding="utf-8") as handle:
        json.dump(index_payload, handle, indent=2, sort_keys=True)
    temp_path.replace(INDEX_PATH)


def sanitize_filename(filename: str) -> str:
    candidate = Path(filename or "").name.strip()
    if not candidate:
        raise HTTPException(status_code=400, detail="Filename is required")

    sanitized = re.sub(r"[^A-Za-z0-9._ -]", "_", candidate)
    sanitized = sanitized.lstrip(".")
    if not sanitized:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not sanitized.lower().endswith(".gpx"):
        raise HTTPException(status_code=400, detail="Only .gpx files are allowed")
    return sanitized


def get_owner_id_from_request(request: Request) -> str | None:
    owner_id = request.cookies.get(OWNER_COOKIE_NAME, "").strip()
    return owner_id or None


def ensure_owner_id(request: Request, response: Response) -> str:
    owner_id = get_owner_id_from_request(request)
    if owner_id:
        return owner_id

    owner_id = secrets.token_urlsafe(18)
    response.set_cookie(
        key=OWNER_COOKIE_NAME,
        value=owner_id,
        max_age=OWNER_COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    return owner_id


def build_owner_filename_key(owner_id: str, filename: str) -> str:
    return f"{owner_id}:{filename}"


def require_owner_id(request: Request) -> str:
    owner_id = get_owner_id_from_request(request)
    if not owner_id:
        raise HTTPException(status_code=403, detail="Missing owner session")
    return owner_id


def validate_gpx_payload(payload: bytes) -> None:
    if not payload:
        raise HTTPException(status_code=400, detail="Empty GPX file")

    try:
        root = ET.fromstring(payload)
    except ET.ParseError as exc:
        raise HTTPException(status_code=400, detail="Invalid GPX XML") from exc

    tag_name = root.tag.split("}")[-1].lower()
    if tag_name != "gpx":
        raise HTTPException(status_code=400, detail="Invalid GPX root element")


def build_share_url(request: Request, gpx_id: str) -> str:
    base_url = str(request.base_url).rstrip("/")
    return f"{base_url}/?gpx={gpx_id}"


def serialize_record(record: dict[str, Any], request: Request) -> dict[str, Any]:
    return {
        "id": record["id"],
        "filename": record["filename"],
        "size": record.get("size"),
        "uploaded_at": record.get("uploaded_at"),
        "share_url": build_share_url(request, record["id"]),
    }


def get_record_or_404(gpx_id: str) -> dict[str, Any]:
    with _index_lock:
        index_payload = load_index()
        record = index_payload["files_by_id"].get(gpx_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    return record


@app.on_event("startup")
def on_startup() -> None:
    APP_DIR.mkdir(parents=True, exist_ok=True)
    ensure_storage_dirs()


@app.get("/api/files")
def list_files(request: Request, response: Response) -> dict[str, list[dict[str, Any]]]:
    owner_id = ensure_owner_id(request, response)
    with _index_lock:
        index_payload = load_index()

    files: list[dict[str, Any]] = []
    for record in index_payload["files_by_id"].values():
        if record.get("owner_id") != owner_id:
            continue
        stored_filename = record.get("stored_filename")
        if not stored_filename:
            continue
        if not (UPLOAD_DIR / stored_filename).exists():
            continue
        files.append(serialize_record(record, request))

    files.sort(key=lambda item: item.get("uploaded_at") or "", reverse=True)
    return {"files": files}


@app.post("/api/upload")
async def upload_file(
    request: Request,
    response: Response,
    file: UploadFile = File(...),
) -> dict[str, Any]:
    filename = sanitize_filename(file.filename or "")
    payload = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="GPX file exceeds upload limit")

    validate_gpx_payload(payload)
    ensure_storage_dirs()
    timestamp = datetime.now(timezone.utc).isoformat()
    owner_id = ensure_owner_id(request, response)
    filename_key = build_owner_filename_key(owner_id, filename)

    with _index_lock:
        index_payload = load_index()
        existing_id = index_payload["filename_to_id"].get(filename_key)
        record_id = existing_id or secrets.token_urlsafe(9)
        existing_record = index_payload["files_by_id"].get(record_id, {})
        stored_filename = existing_record.get("stored_filename") or f"{record_id}.gpx"

        destination = UPLOAD_DIR / stored_filename
        destination.write_bytes(payload)

        record = {
            "id": record_id,
            "filename": filename,
            "owner_id": owner_id,
            "stored_filename": stored_filename,
            "size": len(payload),
            "uploaded_at": timestamp,
        }
        index_payload["files_by_id"][record_id] = record
        index_payload["filename_to_id"][filename_key] = record_id
        save_index(index_payload)

    return serialize_record(record, request)


@app.delete("/api/files/{gpx_id}")
def delete_file(gpx_id: str, request: Request) -> dict[str, str]:
    owner_id = require_owner_id(request)

    with _index_lock:
        index_payload = load_index()
        record = index_payload["files_by_id"].get(gpx_id)
        if not record or record.get("owner_id") != owner_id:
            raise HTTPException(status_code=404, detail="File not found")

        stored_filename = record.get("stored_filename")
        filename = record.get("filename")

        del index_payload["files_by_id"][gpx_id]

        owner_filename_key = build_owner_filename_key(owner_id, filename or "")
        if filename and index_payload["filename_to_id"].get(owner_filename_key) == gpx_id:
            del index_payload["filename_to_id"][owner_filename_key]
        if filename and index_payload["filename_to_id"].get(filename) == gpx_id:
            del index_payload["filename_to_id"][filename]

        save_index(index_payload)

    if stored_filename:
        file_path = UPLOAD_DIR / stored_filename
        try:
            file_path.unlink(missing_ok=True)
        except OSError:
            pass

    return {"status": "deleted", "id": gpx_id}


@app.get("/api/files/{gpx_id}/raw", name="get_raw_file")
def get_raw_file(gpx_id: str) -> FileResponse:
    record = get_record_or_404(gpx_id)
    stored_filename = record.get("stored_filename")
    if not stored_filename:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = UPLOAD_DIR / stored_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        file_path,
        media_type="application/gpx+xml",
        filename=record["filename"],
    )


@app.get("/", include_in_schema=False)
def serve_index() -> FileResponse:
    return FileResponse(APP_DIR / "index.html")


@app.get("/{asset_name}", include_in_schema=False)
def serve_public_asset(asset_name: str) -> FileResponse:
    if asset_name not in PUBLIC_ROOT_FILES:
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(APP_DIR / asset_name)