"""
Classroom Insight — Pydantic Schemas for Internal ML Inference Service
Strict schema compliance with docs/feature_schema.json and docs/API_CONTRACT.md.
"""

from typing import List, Optional, Literal, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


class FeaturesInput(BaseModel):
    """
    Input features for student performance inference.
    Exact canonical schema from docs/feature_schema.json.
    Disallows G3, pass_status, and any unexpected keys.
    """
    model_config = ConfigDict(extra="forbid")

    G1: int = Field(..., ge=0, le=20, description="First-period grade (0-20 scale)")
    G2: int = Field(..., ge=0, le=20, description="Second-period grade (0-20 scale)")
    studytime: int = Field(
        ...,
        description="Weekly study time: 1 (<2 hrs), 2 (2-5 hrs), 3 (5-10 hrs), 4 (>10 hrs)",
    )
    failures: int = Field(
        ...,
        description="Number of past class failures strictly in [0, 1, 2, 3]",
    )
    absences: int = Field(
        ...,
        ge=0,
        le=93,
        description="Total number of school absences (domain 0-93)",
    )
    schoolsup: Literal["no", "yes"] = Field(
        ..., description="Extra educational support from school ('no' or 'yes')"
    )
    famsup: Literal["no", "yes"] = Field(
        ..., description="Family educational support ('no' or 'yes')"
    )
    paid: Literal["no", "yes"] = Field(
        ..., description="Extra paid mathematics classes ('no' or 'yes')"
    )

    @field_validator("studytime")
    @classmethod
    def validate_studytime(cls, v: int) -> int:
        if v not in (1, 2, 3, 4):
            raise ValueError("studytime must be an integer in [1, 2, 3, 4]")
        return v

    @field_validator("failures")
    @classmethod
    def validate_failures(cls, v: int) -> int:
        if v not in (0, 1, 2, 3):
            raise ValueError(
                "failures must be an integer in [0, 1, 2, 3]. Category 4 is absent from dataset and rejected."
            )
        return v


class PredictionRequest(BaseModel):
    """Request envelope for POST /internal/predictions."""
    model_config = ConfigDict(extra="forbid")

    goal: Literal["regression", "classification"] = Field(
        ..., description="Prediction task goal: 'regression' or 'classification'"
    )
    mode: Literal["single", "compare"] = Field(
        ..., description="Inference mode: 'single' for one model, 'compare' for multiple models"
    )
    model_id: Optional[str] = Field(
        default=None, description="Model ID required when mode is 'single'"
    )
    model_ids: Optional[List[str]] = Field(
        default=None, description="List of model IDs required when mode is 'compare'"
    )
    features: FeaturesInput = Field(..., description="The 8 approved student features")

    @model_validator(mode="after")
    def validate_mode_and_models(self) -> "PredictionRequest":
        if self.mode == "single":
            if not self.model_id and (not self.model_ids or len(self.model_ids) != 1):
                raise ValueError("model_id is required when mode is 'single'")
            if not self.model_id and self.model_ids:
                self.model_id = self.model_ids[0]
            if self.model_id and not self.model_ids:
                self.model_ids = [self.model_id]
        elif self.mode == "compare":
            if not self.model_ids or len(self.model_ids) < 1:
                raise ValueError("model_ids must be a non-empty list of model IDs when mode is 'compare'")
            if len(self.model_ids) != len(set(self.model_ids)):
                raise ValueError("model_ids cannot contain duplicate model IDs")
        return self


class ModelPredictionResult(BaseModel):
    """Result per individual model in results array."""
    model_id: str
    model_version: str = "1.0.0"
    status: Literal["success", "failed"]
    predicted_grade: Optional[float] = None
    predicted_class: Optional[Literal["pass", "fail"]] = None
    error_message: Optional[str] = None


class PredictionResponse(BaseModel):
    """Response envelope for POST /internal/predictions."""
    goal: Literal["regression", "classification"]
    mode: Literal["single", "compare"]
    status: Literal["success", "partial_success", "failed"]
    results: List[ModelPredictionResult]


class ModelInfo(BaseModel):
    """Model registry metadata item."""
    model_id: str
    name: str
    family: str
    version: str = "1.0.0"
    status: str = "available"
    description: str
    selected_primary_candidate: Optional[bool] = False


class ModelListResponse(BaseModel):
    """Response for GET /internal/models."""
    goal: Literal["regression", "classification"]
    models: List[ModelInfo]


class ModelPerformanceItem(BaseModel):
    """Model performance item within evaluation report."""
    model_id: str
    name: str
    version: str = "1.0.0"
    status: str = "evaluated"
    metrics: Dict[str, Any]
    cv_metrics: Optional[Dict[str, Any]] = None


class PerformanceResponse(BaseModel):
    """Response for GET /internal/models/performance."""
    goal: Literal["regression", "classification"]
    dataset: str
    evaluation_strategy: str
    test_sample_count: int
    generated_at: str
    models: List[ModelPerformanceItem]


class HealthResponse(BaseModel):
    """Response for GET /internal/health."""
    status: Literal["UP", "DOWN", "DEGRADED"]
    models_loaded_count: int
    service: str
    version: str


class ErrorDetail(BaseModel):
    field: Optional[str] = None
    issue: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: List[ErrorDetail] = Field(default_factory=list)
    request_id: Optional[str] = None


class ErrorResponse(BaseModel):
    error: ErrorBody
    timestamp: str
