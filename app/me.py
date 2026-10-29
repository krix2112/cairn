"""
User State & Data Router (app/me.py)

Manages authenticated user data:
- /me/resumes: CRUD, storage uploads, download signed URLs
- /me/analyses: History, roadmap completion, progress trend
- /me/applications: Tracking job applications across status stages
- /me/export: Complete JSON export with 10-minute signed resume URLs
- /me: Permanent account deletion cascade with typed email confirmation
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from pydantic import BaseModel

from .auth import get_user, optional_user
from . import extract as X
from .socials import extract_socials


router = APIRouter(prefix="/me", tags=["me"])

MAX_RESUME_SIZE = 4 * 1024 * 1024  # 4 MB
ALLOWED_RESUME_EXTS = (".pdf", ".docx")
ALLOWED_MIMES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/msword": ".docx",
    "application/octet-stream": ".pdf"
}


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------
class ResumeUpdate(BaseModel):
    title: Optional[str] = None
    is_primary: Optional[bool] = None


class RoadmapDoneUpdate(BaseModel):
    roadmap_done: Dict[str, Any]


class ApplicationCreate(BaseModel):
    company: str
    role: str
    status: Optional[str] = "saved"
    resume_id: Optional[str] = None
    analysis_id: Optional[str] = None
    job_url: Optional[str] = None
    notes: Optional[str] = None
    applied_on: Optional[str] = None


class ApplicationUpdate(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    resume_id: Optional[str] = None
    analysis_id: Optional[str] = None
    job_url: Optional[str] = None
    notes: Optional[str] = None
    applied_on: Optional[str] = None


class DeleteAccountRequest(BaseModel):
    confirm_email: str


# ---------------------------------------------------------------------------
# Local In-Memory Store (for local dev / offline testing)
# ---------------------------------------------------------------------------
class LocalUserDataStore:
    def __init__(self):
        self.resumes: Dict[str, Dict[str, Any]] = {}
        self.analyses: Dict[str, Dict[str, Any]] = {}
        self.applications: Dict[str, Dict[str, Any]] = {}
        self.files: Dict[str, bytes] = {}

    def clear(self):
        self.resumes.clear()
        self.analyses.clear()
        self.applications.clear()
        self.files.clear()

    # Resumes
    def create_resume(self, user_id: str, title: str, file_name: str, file_bytes: bytes,
                      content_type: str, extracted: dict, socials: list) -> dict:
        ext = ".docx" if file_name.lower().endswith(".docx") else ".pdf"
        res_id = str(uuid.uuid4())
        file_path = f"{user_id}/{res_id}{ext}"
        self.files[file_path] = file_bytes

        # Check existing resumes for this user
        user_resumes = [r for r in self.resumes.values() if r["user_id"] == user_id]
        is_primary = len(user_resumes) == 0

        row = {
            "id": res_id,
            "user_id": user_id,
            "title": title or file_name.rsplit(".", 1)[0],
            "file_name": file_name,
            "file_path": file_path,
            "file_size": len(file_bytes),
            "is_primary": is_primary,
            "extracted": extracted,
            "socials": socials,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        self.resumes[res_id] = row
        return row

    def list_resumes(self, user_id: str) -> List[dict]:
        res = [r for r in self.resumes.values() if r["user_id"] == user_id]
        res.sort(key=lambda x: x["created_at"], reverse=True)
        return res

    def get_resume(self, user_id: str, resume_id: str) -> Optional[dict]:
        r = self.resumes.get(resume_id)
        if r and r["user_id"] == user_id:
            return r
        return None

    def update_resume(self, user_id: str, resume_id: str, title: Optional[str] = None,
                      is_primary: Optional[bool] = None) -> Optional[dict]:
        r = self.get_resume(user_id, resume_id)
        if not r:
            return None
        if title is not None:
            r["title"] = title.strip()
        if is_primary is not None and is_primary:
            for other in self.resumes.values():
                if other["user_id"] == user_id:
                    other["is_primary"] = False
            r["is_primary"] = True
        elif is_primary is not None and not is_primary:
            r["is_primary"] = False
        return r

    def delete_resume(self, user_id: str, resume_id: str) -> bool:
        r = self.get_resume(user_id, resume_id)
        if not r:
            return False
        file_path = r.get("file_path")
        if file_path in self.files:
            del self.files[file_path]
        del self.resumes[resume_id]
        for a in self.analyses.values():
            if a.get("resume_id") == resume_id:
                a["resume_id"] = None
        for app in self.applications.values():
            if app.get("resume_id") == resume_id:
                app["resume_id"] = None
        return True

    def get_resume_download_url(self, user_id: str, resume_id: str, expires_in: int = 60) -> Optional[str]:
        r = self.get_resume(user_id, resume_id)
        if not r:
            return None
        return f"/mock-download/{r['id']}/{r['file_name']}"

    # Analyses
    def create_analysis(self, user_id: str, resume_id: Optional[str], jd_title: Optional[str],
                        jd_company: Optional[str], jd: Optional[dict], result: dict,
                        match_score: Optional[int], readiness_score: Optional[int],
                        ats_score: Optional[int]) -> dict:
        analysis_id = str(uuid.uuid4())
        row = {
            "id": analysis_id,
            "user_id": user_id,
            "resume_id": resume_id,
            "jd_title": jd_title,
            "jd_company": jd_company,
            "jd": jd or {},
            "result": result,
            "match_score": match_score,
            "readiness_score": readiness_score,
            "ats_score": ats_score,
            "roadmap_done": {},
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        self.analyses[analysis_id] = row
        return row

    def list_analyses(self, user_id: str) -> List[dict]:
        res = [a for a in self.analyses.values() if a["user_id"] == user_id]
        res.sort(key=lambda x: x["created_at"], reverse=True)
        # Summarized fields for list view
        return [
            {
                "id": a["id"],
                "resume_id": a.get("resume_id"),
                "jd_title": a.get("jd_title"),
                "jd_company": a.get("jd_company"),
                "match_score": a.get("match_score"),
                "readiness_score": a.get("readiness_score"),
                "ats_score": a.get("ats_score"),
                "created_at": a["created_at"]
            }
            for a in res
        ]

    def get_analysis(self, user_id: str, analysis_id: str) -> Optional[dict]:
        a = self.analyses.get(analysis_id)
        if a and a["user_id"] == user_id:
            return a
        return None

    def delete_analysis(self, user_id: str, analysis_id: str) -> bool:
        a = self.get_analysis(user_id, analysis_id)
        if not a:
            return False
        del self.analyses[analysis_id]
        for app in self.applications.values():
            if app.get("analysis_id") == analysis_id:
                app["analysis_id"] = None
        return True

    def update_roadmap_done(self, user_id: str, analysis_id: str, roadmap_done: dict) -> Optional[dict]:
        a = self.get_analysis(user_id, analysis_id)
        if not a:
            return None
        a["roadmap_done"] = roadmap_done
        return a

    def get_progress(self, user_id: str) -> List[dict]:
        res = [a for a in self.analyses.values() if a["user_id"] == user_id]
        res.sort(key=lambda x: x["created_at"])
        return [
            {
                "id": a["id"],
                "created_at": a["created_at"],
                "match_score": a.get("match_score") or 0,
                "readiness_score": a.get("readiness_score") or 0,
                "ats_score": a.get("ats_score") or 0,
                "company": a.get("jd_company") or "Unknown",
                "role": a.get("jd_title") or "Role"
            }
            for a in res
        ]

    # Applications
    def list_applications(self, user_id: str) -> List[dict]:
        res = [app for app in self.applications.values() if app["user_id"] == user_id]
        res.sort(key=lambda x: x["created_at"], reverse=True)
        return res

    def create_application(self, user_id: str, data: dict) -> dict:
        app_id = str(uuid.uuid4())
        valid_statuses = ('saved', 'applied', 'interview', 'offer', 'rejected')
        st = data.get("status", "saved")
        if st not in valid_statuses:
            st = "saved"
        row = {
            "id": app_id,
            "user_id": user_id,
            "company": data["company"],
            "role": data["role"],
            "status": st,
            "resume_id": data.get("resume_id"),
            "analysis_id": data.get("analysis_id"),
            "job_url": data.get("job_url"),
            "notes": data.get("notes"),
            "applied_on": data.get("applied_on"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        self.applications[app_id] = row
        return row

    def update_application(self, user_id: str, app_id: str, data: dict) -> Optional[dict]:
        app = self.applications.get(app_id)
        if not app or app["user_id"] != user_id:
            return None
        valid_statuses = ('saved', 'applied', 'interview', 'offer', 'rejected')
        for k, v in data.items():
            if v is not None:
                if k == "status" and v not in valid_statuses:
                    continue
                app[k] = v
        return app

    def delete_application(self, user_id: str, app_id: str) -> bool:
        app = self.applications.get(app_id)
        if not app or app["user_id"] != user_id:
            return False
        del self.applications[app_id]
        return True

    # Export & Deletion
    def export_data(self, user_id: str, user_email: str) -> dict:
        resumes = [dict(r) for r in self.resumes.values() if r["user_id"] == user_id]
        for r in resumes:
            r["download_url"] = f"/mock-download/{r['id']}/{r['file_name']}?token=export_token"
        analyses = [a for a in self.analyses.values() if a["user_id"] == user_id]
        applications = [app for app in self.applications.values() if app["user_id"] == user_id]
        return {
            "user": {"id": user_id, "email": user_email},
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "resumes": resumes,
            "analyses": analyses,
            "applications": applications
        }

    def delete_account(self, user_id: str) -> bool:
        # Delete files
        for r in list(self.resumes.values()):
            if r["user_id"] == user_id:
                fp = r.get("file_path")
                if fp in self.files:
                    del self.files[fp]
                del self.resumes[r["id"]]
        for a in list(self.analyses.values()):
            if a["user_id"] == user_id:
                del self.analyses[a["id"]]
        for app in list(self.applications.values()):
            if app["user_id"] == user_id:
                del self.applications[app["id"]]
        return True


# ---------------------------------------------------------------------------
# Supabase Store (PostgREST + Supabase Storage + Admin API)
# ---------------------------------------------------------------------------
class SupabaseUserDataStore:
    def __init__(self, supabase_url: str, supabase_service_key: str, client: Optional[httpx.Client] = None):
        self.supabase_url = supabase_url.rstrip("/")
        self.service_key = supabase_service_key
        self._client = client
        self._local_fallback = LocalUserDataStore()

    def _headers(self, prefer_return: bool = True) -> Dict[str, str]:
        h = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if prefer_return:
            h["Prefer"] = "return=representation"
        return h

    def _request(self, method: str, path: str, **kwargs) -> Optional[httpx.Response]:
        url = f"{self.supabase_url}{path}"
        kwargs.setdefault("timeout", 5.0)
        try:
            if self._client:
                return self._client.request(method, url, **kwargs)
            with httpx.Client(timeout=5.0) as c:
                return c.request(method, url, **kwargs)
        except Exception:
            return None

    # Resumes
    def create_resume(self, user_id: str, title: str, file_name: str, file_bytes: bytes,
                      content_type: str, extracted: dict, socials: list) -> dict:
        ext = ".docx" if file_name.lower().endswith(".docx") else ".pdf"
        res_id = str(uuid.uuid4())
        file_path = f"{user_id}/{res_id}{ext}"

        # 1. Upload to Supabase Storage
        upload_resp = self._request(
            "POST",
            f"/storage/v1/object/resumes/{file_path}",
            headers={
                "apikey": self.service_key,
                "Authorization": f"Bearer {self.service_key}",
                "Content-Type": content_type
            },
            content=file_bytes
        )
        if upload_resp is None or upload_resp.status_code not in (200, 201):
            raise HTTPException(status_code=500, detail="Failed to upload file to storage")

        # 2. Check existing count for is_primary
        existing = self.list_resumes(user_id)
        is_primary = len(existing) == 0

        # 3. Insert row
        payload = {
            "id": res_id,
            "user_id": user_id,
            "title": title or file_name.rsplit(".", 1)[0],
            "file_name": file_name,
            "file_path": file_path,
            "file_size": len(file_bytes),
            "is_primary": is_primary,
            "extracted": extracted,
            "socials": socials
        }
        resp = self._request("POST", "/rest/v1/resumes", headers=self._headers(), json=payload)
        if resp is not None and resp.status_code in (200, 201):
            rows = resp.json()
            return rows[0] if isinstance(rows, list) and rows else payload
        if resp is not None and resp.status_code == 404:
            return self._local_fallback.create_resume(
                user_id=user_id,
                title=title,
                file_name=file_name,
                file_bytes=file_bytes,
                content_type=content_type,
                extracted=extracted,
                socials=socials
            )
        # Rollback storage file
        self._request("DELETE", f"/storage/v1/object/resumes/{file_path}", headers=self._headers())
        raise HTTPException(status_code=500, detail="Failed to save resume record")

    def list_resumes(self, user_id: str) -> List[dict]:
        resp = self._request(
            "GET",
            f"/rest/v1/resumes?user_id=eq.{user_id}&order=created_at.desc&select=id,title,file_name,file_size,is_primary,extracted,socials,created_at",
            headers=self._headers()
        )
        if resp is not None and resp.status_code == 200:
            return resp.json()
        if resp is not None and resp.status_code == 404:
            return self._local_fallback.list_resumes(user_id)
        return []

    def get_resume(self, user_id: str, resume_id: str) -> Optional[dict]:
        resp = self._request(
            "GET",
            f"/rest/v1/resumes?id=eq.{resume_id}&user_id=eq.{user_id}&select=*",
            headers=self._headers()
        )
        if resp is not None and resp.status_code == 200:
            rows = resp.json()
            if rows:
                return rows[0]
        if resp is not None and resp.status_code == 404:
            return self._local_fallback.get_resume(user_id, resume_id)
        return None

    def update_resume(self, user_id: str, resume_id: str, title: Optional[str] = None,
                      is_primary: Optional[bool] = None) -> Optional[dict]:
        # Verify ownership
        current = self.get_resume(user_id, resume_id)
        if not current:
            return None

        if is_primary is True:
            # Clear is_primary on all other user's resumes
            self._request(
                "PATCH",
                f"/rest/v1/resumes?user_id=eq.{user_id}",
                headers=self._headers(prefer_return=False),
                json={"is_primary": False}
            )

        patch_payload = {}
        if title is not None:
            patch_payload["title"] = title.strip()
        if is_primary is not None:
            patch_payload["is_primary"] = is_primary

        if not patch_payload:
            return current

        resp = self._request(
            "PATCH",
            f"/rest/v1/resumes?id=eq.{resume_id}&user_id=eq.{user_id}",
            headers=self._headers(),
            json=patch_payload
        )
        if resp is not None and resp.status_code in (200, 204):
            rows = resp.json()
            return rows[0] if isinstance(rows, list) and rows else current
        return None

    def delete_resume(self, user_id: str, resume_id: str) -> bool:
        r = self.get_resume(user_id, resume_id)
        if not r:
            return False
        file_path = r.get("file_path")
        if file_path:
            self._request("DELETE", f"/storage/v1/object/resumes/{file_path}", headers=self._headers())

        resp = self._request(
            "DELETE",
            f"/rest/v1/resumes?id=eq.{resume_id}&user_id=eq.{user_id}",
            headers=self._headers()
        )
        return resp is not None and resp.status_code in (200, 204)

    def get_resume_download_url(self, user_id: str, resume_id: str, expires_in: int = 60) -> Optional[str]:
        r = self.get_resume(user_id, resume_id)
        if not r:
            return None
        file_path = r.get("file_path")
        if not file_path:
            return None

        resp = self._request(
            "POST",
            f"/storage/v1/object/sign/resumes/{file_path}",
            headers=self._headers(),
            json={"expiresIn": expires_in}
        )
        if resp is not None and resp.status_code == 200:
            data = resp.json()
            signed_path = data.get("signedURL")
            if signed_path:
                return f"{self.supabase_url}/storage/v1{signed_path}"
        return None

    # Analyses
    def create_analysis(self, user_id: str, resume_id: Optional[str], jd_title: Optional[str],
                        jd_company: Optional[str], jd: Optional[dict], result: dict,
                        match_score: Optional[int], readiness_score: Optional[int],
                        ats_score: Optional[int]) -> dict:
        analysis_id = str(uuid.uuid4())
        payload = {
            "id": analysis_id,
            "user_id": user_id,
            "resume_id": resume_id,
            "jd_title": jd_title,
            "jd_company": jd_company,
            "jd": jd or {},
            "result": result,
            "match_score": match_score,
            "readiness_score": readiness_score,
            "ats_score": ats_score,
            "roadmap_done": {}
        }
        resp = self._request("POST", "/rest/v1/analyses", headers=self._headers(), json=payload)
        if resp is not None and resp.status_code in (200, 201):
            rows = resp.json()
            return rows[0] if isinstance(rows, list) and rows else payload
        if resp is not None and resp.status_code == 404:
            return self._local_fallback.create_analysis(
                user_id=user_id,
                resume_id=resume_id,
                jd_title=jd_title,
                jd_company=jd_company,
                jd=jd,
                result=result,
                match_score=match_score,
                readiness_score=readiness_score,
                ats_score=ats_score
            )
        return payload

    def list_analyses(self, user_id: str) -> List[dict]:
        resp = self._request(
            "GET",
            f"/rest/v1/analyses?user_id=eq.{user_id}&order=created_at.desc&select=id,resume_id,jd_title,jd_company,match_score,readiness_score,ats_score,created_at",
            headers=self._headers()
        )
        if resp is not None and resp.status_code == 200:
            return resp.json()
        if resp is not None and resp.status_code == 404:
            return self._local_fallback.list_analyses(user_id)
        return []

    def get_analysis(self, user_id: str, analysis_id: str) -> Optional[dict]:
        resp = self._request(
            "GET",
            f"/rest/v1/analyses?id=eq.{analysis_id}&user_id=eq.{user_id}&select=*",
            headers=self._headers()
        )
        if resp is not None and resp.status_code == 200:
            rows = resp.json()
            if rows:
                return rows[0]
        if resp is not None and resp.status_code == 404:
            return self._local_fallback.get_analysis(user_id, analysis_id)
        return None

    def delete_analysis(self, user_id: str, analysis_id: str) -> bool:
        resp = self._request(
            "DELETE",
            f"/rest/v1/analyses?id=eq.{analysis_id}&user_id=eq.{user_id}",
            headers=self._headers()
        )
        if resp is not None and resp.status_code == 404:
            return self._local_fallback.delete_analysis(user_id, analysis_id)
        return resp is not None and resp.status_code in (200, 204)

    def update_roadmap_done(self, user_id: str, analysis_id: str, roadmap_done: dict) -> Optional[dict]:
        resp = self._request(
            "PATCH",
            f"/rest/v1/analyses?id=eq.{analysis_id}&user_id=eq.{user_id}",
            headers=self._headers(),
            json={"roadmap_done": roadmap_done}
        )
        if resp is not None and resp.status_code in (200, 204):
            rows = resp.json()
            return rows[0] if isinstance(rows, list) and rows else {"id": analysis_id, "roadmap_done": roadmap_done}
        return None

    def get_progress(self, user_id: str) -> List[dict]:
        resp = self._request(
            "GET",
            f"/rest/v1/analyses?user_id=eq.{user_id}&order=created_at.asc&select=id,created_at,match_score,readiness_score,ats_score,jd_company,jd_title",
            headers=self._headers()
        )
        if resp is not None and resp.status_code == 200:
            rows = resp.json()
            return [
                {
                    "id": a["id"],
                    "created_at": a["created_at"],
                    "match_score": a.get("match_score") or 0,
                    "readiness_score": a.get("readiness_score") or 0,
                    "ats_score": a.get("ats_score") or 0,
                    "company": a.get("jd_company") or "Unknown",
                    "role": a.get("jd_title") or "Role"
                }
                for a in rows
            ]
        if resp is not None and resp.status_code == 404:
            return self._local_fallback.get_progress(user_id)
        return []

    # Applications
    def list_applications(self, user_id: str) -> List[dict]:
        resp = self._request(
            "GET",
            f"/rest/v1/applications?user_id=eq.{user_id}&order=created_at.desc&select=*",
            headers=self._headers()
        )
        if resp is not None and resp.status_code == 200:
            return resp.json()
        if resp is not None and resp.status_code == 404:
            return self._local_fallback.list_applications(user_id)
        return []

    def create_application(self, user_id: str, data: dict) -> dict:
        app_id = str(uuid.uuid4())
        valid_statuses = ('saved', 'applied', 'interview', 'offer', 'rejected')
        st = data.get("status", "saved")
        if st not in valid_statuses:
            st = "saved"
        payload = {
            "id": app_id,
            "user_id": user_id,
            "company": data["company"],
            "role": data["role"],
            "status": st,
            "resume_id": data.get("resume_id"),
            "analysis_id": data.get("analysis_id"),
            "job_url": data.get("job_url"),
            "notes": data.get("notes"),
            "applied_on": data.get("applied_on")
        }
        resp = self._request("POST", "/rest/v1/applications", headers=self._headers(), json=payload)
        if resp is not None and resp.status_code in (200, 201):
            rows = resp.json()
            return rows[0] if isinstance(rows, list) and rows else payload
        return payload

    def update_application(self, user_id: str, app_id: str, data: dict) -> Optional[dict]:
        payload = {k: v for k, v in data.items() if v is not None}
        if "status" in payload and payload["status"] not in ('saved', 'applied', 'interview', 'offer', 'rejected'):
            del payload["status"]
        if not payload:
            return None
        resp = self._request(
            "PATCH",
            f"/rest/v1/applications?id=eq.{app_id}&user_id=eq.{user_id}",
            headers=self._headers(),
            json=payload
        )
        if resp is not None and resp.status_code in (200, 204):
            rows = resp.json()
            return rows[0] if isinstance(rows, list) and rows else payload
        return None

    def delete_application(self, user_id: str, app_id: str) -> bool:
        resp = self._request(
            "DELETE",
            f"/rest/v1/applications?id=eq.{app_id}&user_id=eq.{user_id}",
            headers=self._headers()
        )
        return resp is not None and resp.status_code in (200, 204)

    # Export & Deletion
    def export_data(self, user_id: str, user_email: str) -> dict:
        resumes = self.list_resumes(user_id)
        for r in resumes:
            r["download_url"] = self.get_resume_download_url(user_id, r["id"], expires_in=600)
        analyses = self.list_analyses(user_id)
        # Fetch full analyses details for export
        full_analyses = []
        for a in analyses:
            full = self.get_analysis(user_id, a["id"])
            full_analyses.append(full or a)
        applications = self.list_applications(user_id)
        return {
            "user": {"id": user_id, "email": user_email},
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "resumes": resumes,
            "analyses": full_analyses,
            "applications": applications
        }

    def delete_account(self, user_id: str) -> bool:
        # 1. Clean up user files in storage
        resumes = self.list_resumes(user_id)
        for r in resumes:
            fp = r.get("file_path")
            if fp:
                self._request("DELETE", f"/storage/v1/object/resumes/{fp}", headers=self._headers())

        # 2. Delete DB records (resumes, analyses, applications)
        self._request("DELETE", f"/rest/v1/resumes?user_id=eq.{user_id}", headers=self._headers())
        self._request("DELETE", f"/rest/v1/analyses?user_id=eq.{user_id}", headers=self._headers())
        self._request("DELETE", f"/rest/v1/applications?user_id=eq.{user_id}", headers=self._headers())

        # 3. Delete user from auth.users via Admin API
        self._request(
            "DELETE",
            f"/auth/v1/admin/users/{user_id}",
            headers={
                "apikey": self.service_key,
                "Authorization": f"Bearer {self.service_key}"
            }
        )
        return True


# Global User Store Instance Management
_USER_STORE: Optional[Any] = None


def get_user_store(client: Optional[httpx.Client] = None) -> Any:
    global _USER_STORE
    if client is not None:
        supabase_url = os.getenv("SUPABASE_URL", "").strip()
        supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
        if supabase_url and supabase_service_key:
            return SupabaseUserDataStore(supabase_url, supabase_service_key, client=client)
        return LocalUserDataStore()

    if _USER_STORE is not None:
        return _USER_STORE

    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if supabase_url and supabase_service_key:
        _USER_STORE = SupabaseUserDataStore(supabase_url, supabase_service_key)
        return _USER_STORE

    _USER_STORE = LocalUserDataStore()
    return _USER_STORE


def reset_user_store():
    global _USER_STORE
    if _USER_STORE and hasattr(_USER_STORE, "clear"):
        _USER_STORE.clear()
    _USER_STORE = None


# ---------------------------------------------------------------------------
# Router Endpoints
# ---------------------------------------------------------------------------

@router.post("/resumes")
async def upload_resume(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    user: dict = Depends(get_user)
):
    """Uploads resume to storage, extracts skills and socials, saves to resumes table."""
    file_name = file.filename or "resume.pdf"
    ext = os.path.splitext(file_name)[1].lower()
    if ext not in ALLOWED_RESUME_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension '{ext}'. Allowed: {', '.join(ALLOWED_RESUME_EXTS)}"
        )

    content = await file.read()
    if len(content) > MAX_RESUME_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 4 MB limit")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    content_type = file.content_type or ("application/pdf" if ext == ".pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document")

    # In-memory extraction
    extracted = X.extract(content, "resume", file_name, use_cache=True)
    raw_text = X.read_text(content, file_name)
    extracted["_text"] = raw_text
    socials = extract_socials(raw_text, file_bytes=content, filename=file_name)

    clean_title = title.strip() if title and title.strip() else os.path.splitext(file_name)[0]

    store = get_user_store()
    created = store.create_resume(
        user_id=user["id"],
        title=clean_title,
        file_name=file_name,
        file_bytes=content,
        content_type=content_type,
        extracted=extracted,
        socials=socials
    )
    return {
        "id": created["id"],
        "title": created["title"],
        "file_name": created["file_name"],
        "file_size": created["file_size"],
        "is_primary": created.get("is_primary", False),
        "extracted": created["extracted"],
        "socials": created["socials"],
        "created_at": created["created_at"]
    }


@router.get("/resumes")
def list_resumes(user: dict = Depends(get_user)):
    """Lists all resumes uploaded by the authenticated user."""
    store = get_user_store()
    return store.list_resumes(user["id"])


@router.patch("/resumes/{resume_id}")
def update_resume(resume_id: str, body: ResumeUpdate, user: dict = Depends(get_user)):
    """Updates title or primary status of a resume."""
    store = get_user_store()
    updated = store.update_resume(user["id"], resume_id, title=body.title, is_primary=body.is_primary)
    if not updated:
        raise HTTPException(status_code=404, detail="Resume not found")
    return updated


@router.delete("/resumes/{resume_id}")
def delete_resume(resume_id: str, user: dict = Depends(get_user)):
    """Deletes resume from storage and DB."""
    store = get_user_store()
    success = store.delete_resume(user["id"], resume_id)
    if not success:
        raise HTTPException(status_code=404, detail="Resume not found")
    return {"ok": True}


@router.get("/resumes/{resume_id}/download")
def download_resume(resume_id: str, user: dict = Depends(get_user)):
    """Returns a short-lived (60s) signed download URL."""
    store = get_user_store()
    resume = store.get_resume(user["id"], resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    url = store.get_resume_download_url(user["id"], resume_id, expires_in=60)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate download URL")
    return {"url": url, "file_name": resume.get("file_name", "resume.pdf")}


@router.get("/analyses")
def list_analyses(user: dict = Depends(get_user)):
    """Lists past analyses for the user."""
    store = get_user_store()
    return store.list_analyses(user["id"])


@router.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: str, user: dict = Depends(get_user)):
    """Gets complete analysis result and roadmap done state."""
    store = get_user_store()
    analysis = store.get_analysis(user["id"], analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis


@router.delete("/analyses/{analysis_id}")
def delete_analysis(analysis_id: str, user: dict = Depends(get_user)):
    """Deletes an analysis record."""
    store = get_user_store()
    success = store.delete_analysis(user["id"], analysis_id)
    if not success:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {"ok": True}


@router.patch("/analyses/{analysis_id}/roadmap")
def update_analysis_roadmap(analysis_id: str, body: RoadmapDoneUpdate, user: dict = Depends(get_user)):
    """Updates roadmap checklist status."""
    store = get_user_store()
    res = store.update_roadmap_done(user["id"], analysis_id, body.roadmap_done)
    if not res:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {"ok": True, "roadmap_done": body.roadmap_done}


@router.get("/progress")
def get_progress(user: dict = Depends(get_user)):
    """Returns historical score progression for trend charts."""
    store = get_user_store()
    return store.get_progress(user["id"])


@router.get("/applications")
def list_applications(user: dict = Depends(get_user)):
    """Lists tracked job applications."""
    store = get_user_store()
    return store.list_applications(user["id"])


@router.post("/applications")
def create_application(body: ApplicationCreate, user: dict = Depends(get_user)):
    """Tracks a new job application."""
    store = get_user_store()
    return store.create_application(user["id"], body.model_dump())


@router.patch("/applications/{app_id}")
def update_application(app_id: str, body: ApplicationUpdate, user: dict = Depends(get_user)):
    """Updates status or notes for an application."""
    store = get_user_store()
    updated = store.update_application(user["id"], app_id, body.model_dump())
    if not updated:
        raise HTTPException(status_code=404, detail="Application not found")
    return updated


@router.delete("/applications/{app_id}")
def delete_application(app_id: str, user: dict = Depends(get_user)):
    """Deletes an application."""
    store = get_user_store()
    success = store.delete_application(user["id"], app_id)
    if not success:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"ok": True}


@router.get("/export")
def export_user_data(user: dict = Depends(get_user)):
    """Exports all user resumes, analyses, applications with 10-minute download links."""
    store = get_user_store()
    return store.export_data(user["id"], user.get("email", ""))


@router.delete("")
def delete_account(body: DeleteAccountRequest, user: dict = Depends(get_user)):
    """Permanently deletes account and cascades all storage and database records."""
    if body.confirm_email.strip().lower() != user.get("email", "").strip().lower():
        raise HTTPException(
            status_code=400,
            detail="Email confirmation does not match account email"
        )
    store = get_user_store()
    store.delete_account(user["id"])
    return {"ok": True, "message": "Account and all associated data permanently deleted"}

