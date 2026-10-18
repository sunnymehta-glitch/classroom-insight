"""
Classroom Insight — ML Inference FastAPI Service
Internal microservice for model health, discovery, performance metrics,
and student performance inference.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .config import settings
from .loader import loader
from .inference import inference_engine
from .schemas import (
    HealthResponse,
    ModelListResponse,
    PerformanceResponse,
    PredictionRequest,
    PredictionResponse,
    ErrorResponse,
    ErrorBody,
    ErrorDetail,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("classroom_insight.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Service lifespan handler.
    Loads pre-trained model artifacts from disk into memory.
    Strictly NO online training or retraining occurs.
    """
    logger.info("Starting %s v%s", settings.service_name, settings.service_version)
    success = loader.load_artifacts()
    if success:
        logger.info("All model artifacts loaded successfully. Service is healthy.")
    else:
        logger.warning(
            "Service started in DEGRADED/DOWN state. Errors: %s", loader.load_errors
        )
    yield
    logger.info("Shutting down %s", settings.service_name)


app = FastAPI(
    title=settings.service_name,
    version=settings.service_version,
    description="Internal ML inference service for Classroom Insight",
    lifespan=lifespan,
)


# -------------------------------------------------------------------------
# Exception Handlers (Standardized API Error Envelopes)
# -------------------------------------------------------------------------


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Formats validation errors into the canonical ErrorResponse structure."""
    details = []
    for err in exc.errors():
        loc = ".".join(str(l) for l in err.get("loc", []) if l != "body")
        msg = err.get("msg", "Invalid value")
        details.append(ErrorDetail(field=loc or None, issue=msg))

    payload = ErrorResponse(
        error=ErrorBody(
            code="VALIDATION_ERROR",
            message="Input validation failed. Please check the supplied feature values.",
            details=details,
        ),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
    return JSONResponse(status_code=422, content=payload.model_dump())


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Formats standard HTTPExceptions into canonical ErrorResponse structure."""
    detail_msg = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    error_code = "HTTP_ERROR"
    if exc.status_code == 404:
        error_code = "NOT_FOUND"
    elif exc.status_code == 400:
        error_code = "BAD_REQUEST"
    elif exc.status_code == 502:
        error_code = "UPSTREAM_ML_ERROR"
    elif exc.status_code == 503:
        error_code = "SERVICE_UNAVAILABLE"

    payload = ErrorResponse(
        error=ErrorBody(
            code=error_code,
            message=detail_msg,
            details=[],
        ),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump())


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catches unhandled errors without leaking stack traces or internal paths."""
    logger.exception("Unhandled internal server exception: %s", exc)
    payload = ErrorResponse(
        error=ErrorBody(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected server error occurred during request processing.",
            details=[],
        ),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=payload.model_dump())


# -------------------------------------------------------------------------
# Internal Endpoints
# -------------------------------------------------------------------------


@app.get(
    "/internal/health",
    response_model=HealthResponse,
    summary="ML Service Health Check",
    tags=["Internal"],
)
async def get_health(response: Response):
    """
    Reports service health and artifact readiness.
    Returns HTTP 200 when all models are loaded.
    Returns HTTP 503 when models failed to load.
    """
    if loader.is_healthy:
        service_status = "UP"
        response.status_code = status.HTTP_200_OK
    elif loader.models_loaded_count > 0:
        service_status = "DEGRADED"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    else:
        service_status = "DOWN"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthResponse(
        status=service_status,
        models_loaded_count=loader.models_loaded_count,
        service=settings.service_name,
        version=settings.service_version,
    )


@app.get(
    "/internal/models",
    response_model=ModelListResponse,
    summary="List Compatible Models",
    tags=["Internal"],
)
async def list_models(goal: Literal["regression", "classification"]):
    """
    Lists available, loaded models compatible with the requested goal.
    """
    models = loader.list_models_for_goal(goal)
    return ModelListResponse(goal=goal, models=models)


@app.get(
    "/internal/models/performance",
    response_model=PerformanceResponse,
    summary="Get Actual Evaluation Performance Report",
    tags=["Internal"],
)
async def get_performance(goal: Literal["regression", "classification"]):
    """
    Returns genuine offline evaluation metrics from canonical evaluation report.
    """
    try:
        report = loader.get_performance_for_goal(goal)
        return report
    except Exception as e:
        logger.error("Failed to retrieve performance report for goal '%s': %s", goal, e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Performance metrics report is currently unavailable for goal '{goal}'.",
        )


@app.post(
    "/internal/predictions",
    response_model=PredictionResponse,
    summary="Predict Student Performance",
    tags=["Internal"],
)
async def create_prediction(request: PredictionRequest):
    """
    Executes student-performance prediction in single or compare mode.
    Handles regression (0-20 clipping) and classification (pass/fail).
    Supports partial failure reporting in compare mode.
    """
    response = inference_engine.execute_prediction(request)

    # Partial failure vs total failure evaluation
    if response.status == "failed":
        # All requested models failed
        # Determine if it was client error (all models unknown / incompatible)
        all_unknown_or_incompatible = True
        error_details = []
        for r in response.results:
            error_details.append(ErrorDetail(field=r.model_id, issue=r.error_message or "Model failed"))
            meta = loader.get_model_metadata(r.model_id)
            if meta and meta.get("task") == request.goal:
                all_unknown_or_incompatible = False

        if all_unknown_or_incompatible:
            # Client provided non-existent or incompatible models
            error_resp = ErrorResponse(
                error=ErrorBody(
                    code="INVALID_MODEL_SELECTION",
                    message="None of the requested models are valid or compatible with the prediction goal.",
                    details=error_details,
                ),
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=error_resp.model_dump(),
            )
        else:
            # Server-side model inference failure
            error_resp = ErrorResponse(
                error=ErrorBody(
                    code="ALL_MODELS_FAILED",
                    message="All requested models failed during inference execution.",
                    details=error_details,
                ),
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
            return JSONResponse(
                status_code=status.HTTP_502_BAD_GATEWAY,
                content=error_resp.model_dump(),
            )

    # Either full success or partial success
    return response
