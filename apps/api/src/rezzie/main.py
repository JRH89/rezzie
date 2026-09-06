from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .auth import verified_user_id
from .billing import BillingRepository, CheckoutRequest, StripeBillingService
from .config import Settings
from .documents import DocumentService, ResumeExportService, editor_html_to_text
from .middleware import SecurityHeadersMiddleware
from .providers.anthropic import AnthropicProvider
from .records import CareerRecord, CareerRecordRepository
from .schemas import (
    CareerFactCreate,
    CareerFactResponse,
    CareerFactUpdate,
    CareerRecordCreate,
    CareerRecordResponse,
    CreditBalance,
    ImportResponse,
    ResumeExportRequest,
    TailorCareerRecordRequest,
    TailoringResult,
    TailorRequest,
    TextImportRequest,
    UrlImportRequest,
)
from .services import JobDescriptionImporter, TailoringService

settings = Settings()
app = FastAPI(title="Rezzie API", version="v1")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False, allow_methods=["POST", "GET", "PATCH"], allow_headers=["Authorization", "Content-Type"])
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)
app.add_middleware(SecurityHeadersMiddleware, production=settings.environment == "production")
billing_repository = BillingRepository(settings.database_url, bootstrap_schema=settings.environment == "development")
career_records = CareerRecordRepository(billing_repository.sessions)
billing_service = StripeBillingService(settings, billing_repository)
importer, tailoring_service = JobDescriptionImporter(settings), TailoringService(AnthropicProvider(settings.anthropic_model), settings, billing_repository)
document_service = DocumentService(settings)
resume_export_service = ResumeExportService()


def require_user(authorization: str | None, development_user_id: str | None) -> str:
    user_id = verified_user_id(settings, authorization, development_user_id)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication is required.")
    return user_id


def career_record_response(user_id: str, record: CareerRecord) -> CareerRecordResponse:
    facts = career_records.facts(user_id, record.id)
    return CareerRecordResponse(
        id=record.id,
        label=record.label,
        created_at=record.created_at,
        updated_at=record.updated_at,
        facts=[
            CareerFactResponse(
                id=fact.id,
                fact_type=fact.fact_type,
                text=fact.text,
                source_excerpt=fact.source_excerpt,
                status=fact.status,
                evidence_note=fact.evidence_note,
            )
            for fact in facts
        ],
    )

@app.get("/health")
async def health() -> dict[str, str]: return {"status": "ok"}


@app.get("/ready")
async def readiness() -> dict[str, str]:
    try: billing_repository.is_ready()
    except Exception as error: raise HTTPException(status_code=503, detail="Database is unavailable.") from error
    return {"status": "ready"}

@app.post("/api/v1/job-descriptions/text", response_model=ImportResponse)
async def import_text(request: TextImportRequest, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> ImportResponse:
    require_user(authorization, x_rezzie_user_id)
    return ImportResponse(text=request.text, source_type="text")

@app.post("/api/v1/job-descriptions/url", response_model=ImportResponse)
async def import_url(request: UrlImportRequest, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> ImportResponse:
    require_user(authorization, x_rezzie_user_id)
    return await importer.from_url(str(request.url))

@app.post("/api/v1/job-descriptions/file", response_model=ImportResponse)
async def import_file(file: UploadFile = File(...), authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> ImportResponse:  # noqa: B008
    require_user(authorization, x_rezzie_user_id)
    return ImportResponse(text=await document_service.extract(file), source_type="file")


@app.post("/api/v1/resumes/file", response_model=ImportResponse)
async def import_resume_file(file: UploadFile = File(...), authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> ImportResponse:  # noqa: B008
    require_user(authorization, x_rezzie_user_id)
    return ImportResponse(text=await document_service.extract(file), source_type="file")


@app.post("/api/v1/resumes/export")
def export_resume(request: ResumeExportRequest, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> Response:
    """Create an editable DOCX without persisting the candidate's document."""
    require_user(authorization, x_rezzie_user_id)
    content = resume_export_service.render_docx(editor_html_to_text(request.resume_html, request.resume_text))
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": 'attachment; filename="rezzie-tailored-resume.docx"',
            "Cache-Control": "no-store",
        },
    )


@app.post("/api/v1/resumes/export/pdf")
def export_resume_pdf(request: ResumeExportRequest, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> Response:
    """Create a printable PDF without persisting the candidate's document."""
    require_user(authorization, x_rezzie_user_id)
    content = resume_export_service.render_pdf(editor_html_to_text(request.resume_html, request.resume_text))
    return Response(content=content, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="rezzie-tailored-resume.pdf"', "Cache-Control": "no-store"})


@app.post("/api/v1/career-records", response_model=CareerRecordResponse)
def create_career_record(request: CareerRecordCreate, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> CareerRecordResponse:
    user_id = require_user(authorization, x_rezzie_user_id)
    return career_record_response(user_id, career_records.create(user_id, request.label, request.source_text))


@app.get("/api/v1/career-records", response_model=list[CareerRecordResponse])
def list_career_records(authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> list[CareerRecordResponse]:
    user_id = require_user(authorization, x_rezzie_user_id)
    return [career_record_response(user_id, record) for record in career_records.list_records(user_id)]


@app.get("/api/v1/career-records/{record_id}", response_model=CareerRecordResponse)
def get_career_record(record_id: str, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> CareerRecordResponse:
    user_id = require_user(authorization, x_rezzie_user_id)
    return career_record_response(user_id, career_records.record(user_id, record_id))


@app.patch("/api/v1/career-records/{record_id}/facts/{fact_id}", response_model=CareerFactResponse)
def update_career_fact(record_id: str, fact_id: str, request: CareerFactUpdate, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> CareerFactResponse:
    user_id = require_user(authorization, x_rezzie_user_id)
    fact = career_records.update_fact(user_id, record_id, fact_id, text=request.text, status=request.status, evidence_note=request.evidence_note)
    return CareerFactResponse(id=fact.id, fact_type=fact.fact_type, text=fact.text, source_excerpt=fact.source_excerpt, status=fact.status, evidence_note=fact.evidence_note)


@app.post("/api/v1/career-records/{record_id}/facts", response_model=CareerFactResponse)
def add_career_fact(record_id: str, request: CareerFactCreate, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> CareerFactResponse:
    user_id = require_user(authorization, x_rezzie_user_id)
    fact = career_records.add_fact(user_id, record_id, fact_type=request.fact_type, text=request.text, evidence_note=request.evidence_note)
    return CareerFactResponse(id=fact.id, fact_type=fact.fact_type, text=fact.text, source_excerpt=fact.source_excerpt, status=fact.status, evidence_note=fact.evidence_note)

@app.post("/api/v1/tailor", response_model=TailoringResult)
async def tailor(request: TailorRequest, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> TailoringResult:
    user_id = verified_user_id(settings, authorization, x_rezzie_user_id)
    try: return await tailoring_service.tailor(request, user_id)
    except ValueError as error: raise HTTPException(status_code=502, detail=str(error)) from error


@app.post("/api/v1/tailor/career-record", response_model=TailoringResult)
async def tailor_career_record(request: TailorCareerRecordRequest, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> TailoringResult:
    user_id = require_user(authorization, x_rezzie_user_id)
    tailoring_request = TailorRequest(
        resume_text=career_records.confirmed_source(user_id, request.record_id),
        job_description=request.job_description,
        credential_mode=request.credential_mode,
        api_key=request.api_key,
    )
    try:
        return await tailoring_service.tailor(tailoring_request, user_id)
    except ValueError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.post("/api/v1/billing/checkout")
def create_checkout(request: CheckoutRequest, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> dict[str, str]:
    user_id = require_user(authorization, x_rezzie_user_id)
    return {"url": billing_service.checkout(user_id, request)}


@app.get("/api/v1/billing/me", response_model=CreditBalance)
def billing_balance(authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> CreditBalance:
    status, subscription_remaining, purchased_credits = billing_repository.balance(require_user(authorization, x_rezzie_user_id))
    return CreditBalance(subscription_status=status, subscription_remaining=subscription_remaining, purchased_credits=purchased_credits)


@app.post("/api/v1/billing/portal")
def billing_portal(authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> dict[str, str]:
    return {"url": billing_service.portal(require_user(authorization, x_rezzie_user_id))}


@app.post("/api/v1/billing/webhook")
async def stripe_webhook(request: Request, stripe_signature: str | None = Header(default=None)) -> dict[str, bool]:
    billing_service.webhook(await request.body(), stripe_signature)
    return {"received": True}
