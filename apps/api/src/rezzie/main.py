from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .auth import verified_user_id
from .billing import BillingRepository, CheckoutRequest, StripeBillingService
from .config import Settings
from .documents import DocumentService
from .providers.anthropic import AnthropicProvider
from .schemas import (
    ImportResponse,
    TailoringResult,
    TailorRequest,
    TextImportRequest,
    UrlImportRequest,
)
from .services import JobDescriptionImporter, TailoringService

settings = Settings()
app = FastAPI(title="Rezzie API", version="v1")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False, allow_methods=["POST", "GET"], allow_headers=["Content-Type"])
billing_repository = BillingRepository(settings.database_url)
billing_service = StripeBillingService(settings, billing_repository)
importer, tailoring_service = JobDescriptionImporter(settings), TailoringService(AnthropicProvider(), settings, billing_repository)
document_service = DocumentService(settings)


def require_user(authorization: str | None, development_user_id: str | None) -> str:
    user_id = verified_user_id(settings, authorization, development_user_id)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication is required.")
    return user_id

@app.get("/health")
async def health() -> dict[str, str]: return {"status": "ok"}


@app.get("/ready")
async def readiness() -> dict[str, str]: return {"status": "ready"}

@app.post("/api/v1/job-descriptions/text", response_model=ImportResponse)
async def import_text(request: TextImportRequest) -> ImportResponse:
    return ImportResponse(text=request.text, source_type="text")

@app.post("/api/v1/job-descriptions/url", response_model=ImportResponse)
async def import_url(request: UrlImportRequest) -> ImportResponse:
    return await importer.from_url(str(request.url))

@app.post("/api/v1/job-descriptions/file", response_model=ImportResponse)
async def import_file(file: UploadFile = File(...)) -> ImportResponse:  # noqa: B008
    return ImportResponse(text=await document_service.extract(file), source_type="file")


@app.post("/api/v1/resumes/file", response_model=ImportResponse)
async def import_resume_file(file: UploadFile = File(...)) -> ImportResponse:  # noqa: B008
    return ImportResponse(text=await document_service.extract(file), source_type="file")

@app.post("/api/v1/tailor", response_model=TailoringResult)
async def tailor(request: TailorRequest, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> TailoringResult:
    user_id = verified_user_id(settings, authorization, x_rezzie_user_id)
    try: return await tailoring_service.tailor(request, user_id)
    except ValueError as error: raise HTTPException(status_code=502, detail=str(error)) from error


@app.post("/api/v1/billing/checkout")
def create_checkout(request: CheckoutRequest, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> dict[str, str]:
    user_id = require_user(authorization, x_rezzie_user_id)
    return {"url": billing_service.checkout(user_id, request)}


@app.post("/api/v1/billing/webhook")
async def stripe_webhook(request: Request, stripe_signature: str | None = Header(default=None)) -> dict[str, bool]:
    billing_service.webhook(await request.body(), stripe_signature)
    return {"received": True}
