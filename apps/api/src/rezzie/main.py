from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .billing import BillingRepository, CheckoutRequest, StripeBillingService
from .config import Settings
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


def local_development_user(x_rezzie_user_id: str | None = Header(default=None)) -> str:
    if settings.environment != "development":
        raise HTTPException(status_code=503, detail="Connect the production identity provider before enabling billing endpoints.")
    if not x_rezzie_user_id or len(x_rezzie_user_id) > 128:
        raise HTTPException(status_code=401, detail="A development user ID is required.")
    return x_rezzie_user_id

@app.get("/health")
async def health() -> dict[str, str]: return {"status": "ok"}

@app.post("/api/v1/job-descriptions/text", response_model=ImportResponse)
async def import_text(request: TextImportRequest) -> ImportResponse:
    return ImportResponse(text=request.text, source_type="text")

@app.post("/api/v1/job-descriptions/url", response_model=ImportResponse)
async def import_url(request: UrlImportRequest) -> ImportResponse:
    return await importer.from_url(str(request.url))

@app.post("/api/v1/job-descriptions/file", response_model=ImportResponse)
async def import_file(file: UploadFile = File(...)) -> ImportResponse:  # noqa: B008
    if file.content_type not in {"text/plain", "text/markdown"}:
        raise HTTPException(status_code=422, detail="Only .txt or .md job descriptions are supported currently.")
    data = await file.read(settings.max_import_bytes + 1)
    if len(data) > settings.max_import_bytes:
        raise HTTPException(status_code=413, detail="File exceeds the 200 KB limit.")
    text = data.decode("utf-8", errors="replace").strip()
    if len(text) < 50: raise HTTPException(status_code=422, detail="The uploaded file is too short.")
    return ImportResponse(text=text, source_type="file")

@app.post("/api/v1/tailor", response_model=TailoringResult)
async def tailor(request: TailorRequest, x_rezzie_user_id: str | None = Header(default=None)) -> TailoringResult:
    try: return await tailoring_service.tailor(request, x_rezzie_user_id)
    except ValueError as error: raise HTTPException(status_code=502, detail=str(error)) from error


@app.post("/api/v1/billing/checkout")
def create_checkout(request: CheckoutRequest, user_id: str = Header(alias="X-Rezzie-User-Id")) -> dict[str, str]:
    # Header identity is accepted only for local development; replace with verified auth subject in production.
    user_id = local_development_user(user_id)
    return {"url": billing_service.checkout(user_id, request)}


@app.post("/api/v1/billing/webhook")
async def stripe_webhook(request: Request, stripe_signature: str | None = Header(default=None)) -> dict[str, bool]:
    billing_service.webhook(await request.body(), stripe_signature)
    return {"received": True}
