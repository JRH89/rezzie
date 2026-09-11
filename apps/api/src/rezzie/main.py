from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .auth import is_configured_admin, verified_identity, verified_user_id
from .billing import BillingRepository, CheckoutRequest, StripeBillingService
from .config import Settings
from .documents import DocumentService, RichResumeExportService, editor_html_to_text
from .middleware import SecurityHeadersMiddleware
from .providers.anthropic import AnthropicProvider
from .rate_limits import RateLimiter
from .records import CareerRecord, CareerRecordRepository
from .resume_library import (
    ResumeLibraryService,
    ResumeVersion,
    SavedResume,
    SavedTailoringDraft,
)
from .schemas import (
    CareerFactCreate,
    CareerFactResponse,
    CareerFactUpdate,
    CareerRecordCreate,
    CareerRecordResponse,
    CreditBalance,
    ImportResponse,
    ResumeExportRequest,
    ResumeVersionCreate,
    SavedResumeCreate,
    SavedResumeResponse,
    SavedTailoringDraftCreate,
    SavedTailoringDraftResponse,
    SupportMessageResponse,
    SupportTicketCreate,
    SupportTicketReplyCreate,
    SupportTicketResponse,
    SupportTicketStatusUpdate,
    TailorCareerRecordRequest,
    TailoringResult,
    TailorRequest,
    TextImportRequest,
    TrustedSourceCreate,
    TrustedSourceResponse,
    UrlImportRequest,
)
from .services import JobDescriptionImporter, TailoringService
from .support import SupportRepository, SupportTicket
from .trusted_sources import (
    ExternalSource,
    TrustedSourceRepository,
    TrustedSourceService,
)

settings = Settings()
app = FastAPI(title="Rezzie API", version="v1")
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)
app.add_middleware(SecurityHeadersMiddleware, production=settings.environment == "production")
billing_repository = BillingRepository(settings.database_url, bootstrap_schema=settings.environment == "development")
career_records = CareerRecordRepository(billing_repository.sessions)
trusted_sources = TrustedSourceRepository(billing_repository.sessions)
trusted_source_service = TrustedSourceService(trusted_sources, billing_repository)
rate_limiter = RateLimiter(billing_repository.sessions, settings.rate_limit_salt)
resume_library = ResumeLibraryService(billing_repository.sessions, billing_repository)
support_tickets = SupportRepository(billing_repository.sessions)
billing_service = StripeBillingService(settings, billing_repository)
importer, tailoring_service = JobDescriptionImporter(settings), TailoringService(
    AnthropicProvider(
        settings.anthropic_model,
        max_tokens=settings.anthropic_max_tokens,
        effort=settings.anthropic_effort,
    ),
    settings,
    billing_repository,
)
document_service = DocumentService(settings)
resume_export_service = RichResumeExportService()


def require_user(authorization: str | None, development_user_id: str | None) -> str:
    user_id = verified_user_id(settings, authorization, development_user_id)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication is required.")
    return user_id


def require_admin(authorization: str | None, development_user_id: str | None, development_user_email: str | None) -> str:
    identity = verified_identity(settings, authorization, development_user_id, development_user_email)
    if not identity:
        raise HTTPException(status_code=401, detail="Authentication is required.")
    if not is_configured_admin(settings, identity):
        raise HTTPException(status_code=403, detail="Administrator access is required.")
    return identity.user_id


def cors_error_headers(request: Request) -> dict[str, str]:
    """Preserve an allowed browser origin on sanitized generation failures."""
    origin = request.headers.get("origin")
    if origin in settings.cors_origins:
        return {"Access-Control-Allow-Origin": origin, "Vary": "Origin"}
    return {}


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


def saved_resume_response(resume: SavedResume, version: ResumeVersion) -> SavedResumeResponse:
    return SavedResumeResponse(
        id=resume.id,
        version_id=version.id,
        label=resume.label,
        source_text=version.source_text,
        created_at=resume.created_at,
        updated_at=resume.updated_at,
    )


def saved_draft_response(draft: SavedTailoringDraft) -> SavedTailoringDraftResponse:
    return SavedTailoringDraftResponse(
        id=draft.id,
        resume_id=draft.resume_id,
        label=draft.label,
        tailored_resume=draft.tailored_resume,
        resume_html=draft.resume_html,
        created_at=draft.created_at,
    )


def trusted_source_response(source: ExternalSource) -> TrustedSourceResponse:
    return TrustedSourceResponse(id=source.id, label=source.label, url=source.url, source_type=source.source_type, fetched_at=source.fetched_at)


def support_ticket_response(ticket: SupportTicket, *, include_messages: bool = False) -> SupportTicketResponse:
    messages = support_tickets.messages(ticket.id) if include_messages else []
    return SupportTicketResponse(
        id=ticket.id, subject=ticket.subject, category=ticket.category, status=ticket.status,
        created_at=ticket.created_at, updated_at=ticket.updated_at,
        messages=[SupportMessageResponse(id=message.id, author_role=message.author_role, body=message.body, created_at=message.created_at) for message in messages],
    )


@app.middleware("http")
async def limit_public_requests(request: Request, call_next: object) -> Response:
    if request.method == "OPTIONS" or request.url.path in {"/health", "/ready", "/api/v1/billing/webhook"}:
        return await call_next(request)  # type: ignore[operator]
    if request.url.path.startswith("/api/"):
        try:
            rate_limiter.enforce("api-ip", request.client.host if request.client else "unknown", limit=120, seconds=60)
        except HTTPException as error:
            return JSONResponse(status_code=error.status_code, content={"detail": error.detail}, headers=error.headers)
    return await call_next(request)  # type: ignore[operator]

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
    document = await document_service.extract(file)
    return ImportResponse(text=document.text, source_type="file", page_count=document.page_count, style_profile=document.style_profile, entry_lines=document.entry_lines or [])


@app.post("/api/v1/resumes/file", response_model=ImportResponse)
async def import_resume_file(file: UploadFile = File(...), authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> ImportResponse:  # noqa: B008
    require_user(authorization, x_rezzie_user_id)
    document = await document_service.extract(file)
    return ImportResponse(text=document.text, source_type="file", page_count=document.page_count, style_profile=document.style_profile, entry_lines=document.entry_lines or [])


@app.post("/api/v1/resumes", response_model=SavedResumeResponse, status_code=201)
def save_resume(request: SavedResumeCreate, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> SavedResumeResponse:
    resume, version = resume_library.create(require_user(authorization, x_rezzie_user_id), label=request.label, source_text=request.source_text)
    return saved_resume_response(resume, version)


@app.get("/api/v1/resumes", response_model=list[SavedResumeResponse])
def list_saved_resumes(authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> list[SavedResumeResponse]:
    return [saved_resume_response(resume, version) for resume, version in resume_library.list(require_user(authorization, x_rezzie_user_id))]


@app.get("/api/v1/resumes/{resume_id}", response_model=SavedResumeResponse)
def get_saved_resume(resume_id: str, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> SavedResumeResponse:
    resume, version = resume_library.get(require_user(authorization, x_rezzie_user_id), resume_id)
    return saved_resume_response(resume, version)


@app.post("/api/v1/resumes/{resume_id}/versions", response_model=SavedResumeResponse, status_code=201)
def add_resume_version(resume_id: str, request: ResumeVersionCreate, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> SavedResumeResponse:
    resume, version = resume_library.add_version(require_user(authorization, x_rezzie_user_id), resume_id, request.source_text)
    return saved_resume_response(resume, version)


@app.delete("/api/v1/resumes/{resume_id}", status_code=204)
def delete_saved_resume(resume_id: str, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> Response:
    resume_library.delete(require_user(authorization, x_rezzie_user_id), resume_id)
    return Response(status_code=204)


@app.post("/api/v1/trusted-sources", response_model=TrustedSourceResponse, status_code=201)
async def add_trusted_source(request: TrustedSourceCreate, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> TrustedSourceResponse:
    user_id = require_user(authorization, x_rezzie_user_id)
    rate_limiter.enforce("trusted-source-user", user_id, limit=5, seconds=3_600)
    if not request.ownership_attested:
        raise HTTPException(status_code=422, detail="Confirm that you own or are authorized to use this public source.")
    source = await trusted_source_service.add(user_id, url=str(request.url), label=request.label.strip())
    return trusted_source_response(source)


@app.get("/api/v1/trusted-sources", response_model=list[TrustedSourceResponse])
def list_trusted_sources(authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> list[TrustedSourceResponse]:
    return [trusted_source_response(source) for source in trusted_sources.list(require_user(authorization, x_rezzie_user_id))]


@app.delete("/api/v1/trusted-sources/{source_id}", status_code=204)
def delete_trusted_source(source_id: str, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> Response:
    trusted_sources.delete(require_user(authorization, x_rezzie_user_id), source_id)
    return Response(status_code=204)


@app.post("/api/v1/tailoring-drafts", response_model=SavedTailoringDraftResponse, status_code=201)
def save_tailoring_draft(request: SavedTailoringDraftCreate, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> SavedTailoringDraftResponse:
    draft = resume_library.save_draft(
        require_user(authorization, x_rezzie_user_id), label=request.label, tailored_resume=request.tailored_resume,
        resume_html=request.resume_html, resume_id=request.resume_id,
    )
    return saved_draft_response(draft)


@app.get("/api/v1/tailoring-drafts", response_model=list[SavedTailoringDraftResponse])
def list_tailoring_drafts(authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> list[SavedTailoringDraftResponse]:
    return [saved_draft_response(draft) for draft in resume_library.list_drafts(require_user(authorization, x_rezzie_user_id))]


@app.get("/api/v1/tailoring-drafts/{draft_id}", response_model=SavedTailoringDraftResponse)
def get_tailoring_draft(draft_id: str, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> SavedTailoringDraftResponse:
    return saved_draft_response(resume_library.draft(require_user(authorization, x_rezzie_user_id), draft_id))


@app.delete("/api/v1/tailoring-drafts/{draft_id}", status_code=204)
def delete_tailoring_draft(draft_id: str, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> Response:
    resume_library.delete_draft(require_user(authorization, x_rezzie_user_id), draft_id)
    return Response(status_code=204)


@app.post("/api/v1/resumes/export")
def export_resume(request: ResumeExportRequest, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> Response:
    """Create an editable DOCX without persisting the candidate's document."""
    require_user(authorization, x_rezzie_user_id)
    content = resume_export_service.render_docx(editor_html_to_text(request.resume_html, request.resume_text), request.resume_html, request.target_page_count, request.template_id, request.style_profile)
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
    content = resume_export_service.render_pdf(editor_html_to_text(request.resume_html, request.resume_text), request.resume_html, request.target_page_count, request.template_id, request.style_profile)
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
async def tailor(request: TailorRequest, http_request: Request, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None), x_rezzie_user_email: str | None = Header(default=None)) -> TailoringResult:
    identity = verified_identity(settings, authorization, x_rezzie_user_id, x_rezzie_user_email)
    user_id = identity.user_id if identity else None
    admin_override = is_configured_admin(settings, identity)
    if request.external_source_ids:
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication is required for Trusted Sources.")
        rate_limiter.enforce("source-backed-tailoring-user", user_id, limit=12, seconds=900)
        sources = trusted_sources.selected(user_id, request.external_source_ids)
        if not admin_override and not billing_repository.has_active_subscription(user_id):
            raise HTTPException(status_code=403, detail="Trusted Sources are available with an active Rezzie subscription.")
    else:
        if user_id:
            rate_limiter.enforce("tailoring-user", user_id, limit=12, seconds=900)
        sources = []
    try: return await tailoring_service.tailor(request, user_id, sources, admin_override=admin_override)
    except ValueError as error: raise HTTPException(status_code=502, detail=str(error), headers=cors_error_headers(http_request)) from error


@app.post("/api/v1/tailor/career-record", response_model=TailoringResult)
async def tailor_career_record(request: TailorCareerRecordRequest, http_request: Request, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None), x_rezzie_user_email: str | None = Header(default=None)) -> TailoringResult:
    identity = verified_identity(settings, authorization, x_rezzie_user_id, x_rezzie_user_email)
    if not identity:
        raise HTTPException(status_code=401, detail="Authentication is required.")
    user_id = identity.user_id
    tailoring_request = TailorRequest(
        resume_text=career_records.confirmed_source(user_id, request.record_id),
        job_description=request.job_description,
        credential_mode=request.credential_mode,
        api_key=request.api_key,
    )
    try:
        return await tailoring_service.tailor(tailoring_request, user_id, admin_override=is_configured_admin(settings, identity))
    except ValueError as error:
        raise HTTPException(status_code=502, detail=str(error), headers=cors_error_headers(http_request)) from error


@app.post("/api/v1/billing/checkout")
def create_checkout(request: CheckoutRequest, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None), x_rezzie_user_email: str | None = Header(default=None)) -> dict[str, str]:
    identity = verified_identity(settings, authorization, x_rezzie_user_id, x_rezzie_user_email)
    if not identity:
        raise HTTPException(status_code=401, detail="Authentication is required.")
    if is_configured_admin(settings, identity):
        raise HTTPException(status_code=403, detail="Your administrator account has unlimited internal access and does not need checkout.")
    user_id = identity.user_id
    return {"url": billing_service.checkout(user_id, request)}


@app.get("/api/v1/billing/me", response_model=CreditBalance)
def billing_balance(authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None), x_rezzie_user_email: str | None = Header(default=None)) -> CreditBalance:
    identity = verified_identity(settings, authorization, x_rezzie_user_id, x_rezzie_user_email)
    if not identity:
        raise HTTPException(status_code=401, detail="Authentication is required.")
    if is_configured_admin(settings, identity):
        return CreditBalance(subscription_status="active", subscription_remaining=0, purchased_credits=0, unlimited=True)
    status, subscription_remaining, purchased_credits = billing_repository.balance(identity.user_id)
    return CreditBalance(subscription_status=status, subscription_remaining=subscription_remaining, purchased_credits=purchased_credits)


@app.post("/api/v1/billing/portal")
def billing_portal(authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> dict[str, str]:
    return {"url": billing_service.portal(require_user(authorization, x_rezzie_user_id))}


@app.post("/api/v1/billing/webhook")
async def stripe_webhook(request: Request, stripe_signature: str | None = Header(default=None)) -> dict[str, bool]:
    billing_service.webhook(await request.body(), stripe_signature)
    return {"received": True}


@app.post("/api/v1/support/tickets", response_model=SupportTicketResponse, status_code=201)
def create_support_ticket(request: SupportTicketCreate, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> SupportTicketResponse:
    user_id = require_user(authorization, x_rezzie_user_id)
    rate_limiter.enforce("support-ticket-user", user_id, limit=10, seconds=3_600)
    return support_ticket_response(support_tickets.create(user_id, subject=request.subject, category=request.category, message=request.message), include_messages=True)


@app.get("/api/v1/support/tickets", response_model=list[SupportTicketResponse])
def list_support_tickets(authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> list[SupportTicketResponse]:
    return [support_ticket_response(ticket) for ticket in support_tickets.list_for_user(require_user(authorization, x_rezzie_user_id))]


@app.get("/api/v1/support/tickets/{ticket_id}", response_model=SupportTicketResponse)
def get_support_ticket(ticket_id: str, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> SupportTicketResponse:
    return support_ticket_response(support_tickets.get_for_user(require_user(authorization, x_rezzie_user_id), ticket_id), include_messages=True)


@app.post("/api/v1/support/tickets/{ticket_id}/messages", response_model=SupportTicketResponse)
def reply_to_support_ticket(ticket_id: str, request: SupportTicketReplyCreate, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None)) -> SupportTicketResponse:
    user_id = require_user(authorization, x_rezzie_user_id)
    support_tickets.get_for_user(user_id, ticket_id)
    rate_limiter.enforce("support-message-user", user_id, limit=30, seconds=3_600)
    return support_ticket_response(support_tickets.reply(ticket_id, author_id=user_id, author_role="customer", body=request.message), include_messages=True)


@app.get("/api/v1/admin/support/tickets", response_model=list[SupportTicketResponse])
def list_admin_support_tickets(authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None), x_rezzie_user_email: str | None = Header(default=None)) -> list[SupportTicketResponse]:
    require_admin(authorization, x_rezzie_user_id, x_rezzie_user_email)
    return [support_ticket_response(ticket) for ticket in support_tickets.list_all()]


@app.get("/api/v1/admin/support/tickets/{ticket_id}", response_model=SupportTicketResponse)
def get_admin_support_ticket(ticket_id: str, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None), x_rezzie_user_email: str | None = Header(default=None)) -> SupportTicketResponse:
    require_admin(authorization, x_rezzie_user_id, x_rezzie_user_email)
    return support_ticket_response(support_tickets.get_any(ticket_id), include_messages=True)


@app.post("/api/v1/admin/support/tickets/{ticket_id}/messages", response_model=SupportTicketResponse)
def reply_to_admin_support_ticket(ticket_id: str, request: SupportTicketReplyCreate, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None), x_rezzie_user_email: str | None = Header(default=None)) -> SupportTicketResponse:
    admin_id = require_admin(authorization, x_rezzie_user_id, x_rezzie_user_email)
    return support_ticket_response(support_tickets.reply(ticket_id, author_id=admin_id, author_role="staff", body=request.message), include_messages=True)


@app.patch("/api/v1/admin/support/tickets/{ticket_id}", response_model=SupportTicketResponse)
def update_admin_support_ticket(ticket_id: str, request: SupportTicketStatusUpdate, authorization: str | None = Header(default=None), x_rezzie_user_id: str | None = Header(default=None), x_rezzie_user_email: str | None = Header(default=None)) -> SupportTicketResponse:
    require_admin(authorization, x_rezzie_user_id, x_rezzie_user_email)
    return support_ticket_response(support_tickets.update_status(ticket_id, request.status), include_messages=True)


# The wrapper sits outside Starlette's ServerErrorMiddleware, so browser clients
# retain CORS headers even if an unexpected exception escapes a route.
app = CORSMiddleware(
    app=app,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["DELETE", "GET", "PATCH", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
