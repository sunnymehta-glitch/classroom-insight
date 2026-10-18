"""
Classroom Insight — ML Inference Engine
Executes deterministic predictions for regression (with 0-20 grade clipping)
and classification (pass/fail classes).
Supports single and comparison modes with partial-success aggregation.
"""

import logging
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd

from .schemas import (
    PredictionRequest,
    PredictionResponse,
    ModelPredictionResult,
    FeaturesInput,
)
from .loader import ModelLoader, loader

logger = logging.getLogger("classroom_insight.inference")

CANONICAL_FEATURES = [
    "G1",
    "G2",
    "studytime",
    "failures",
    "absences",
    "schoolsup",
    "famsup",
    "paid",
]


class ModelInferenceException(Exception):
    """Raised when an individual model fails during inference."""
    def __init__(self, model_id: str, message: str, status_code: int = 502):
        self.model_id = model_id
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class InferenceEngine:
    """Inference engine managing feature transformation and model predictions."""

    def __init__(self, model_loader: Optional[ModelLoader] = None):
        self.loader = model_loader or loader

    def features_to_dataframe(self, features: FeaturesInput) -> pd.DataFrame:
        """
        Converts validated FeaturesInput to a pandas DataFrame
        with canonical column order strictly preserved.
        """
        data = features.model_dump()
        df = pd.DataFrame([data])[CANONICAL_FEATURES]
        return df

    def predict_model(
        self,
        model_id: str,
        goal: str,
        features_df: pd.DataFrame,
    ) -> ModelPredictionResult:
        """
        Performs inference for a single model with error containment.
        Returns ModelPredictionResult with success or safe failure description.
        """
        # 1. Verify model is registered
        model_meta = self.loader.get_model_metadata(model_id)
        if not model_meta:
            return ModelPredictionResult(
                model_id=model_id,
                model_version="1.0.0",
                status="failed",
                error_message=f"Model '{model_id}' is unknown or not registered.",
            )

        # 2. Verify task / goal compatibility
        model_task = model_meta.get("task")
        if model_task != goal:
            return ModelPredictionResult(
                model_id=model_id,
                model_version=model_meta.get("version", "1.0.0"),
                status="failed",
                error_message=f"Model '{model_id}' is a {model_task} model, incompatible with requested goal '{goal}'.",
            )

        # 3. Verify artifact is loaded
        payload = self.loader.get_model_payload(model_id)
        if not payload or "pipeline" not in payload:
            return ModelPredictionResult(
                model_id=model_id,
                model_version=model_meta.get("version", "1.0.0"),
                status="failed",
                error_message=f"Model artifact for '{model_id}' is unavailable or failed to load.",
            )

        pipeline = payload["pipeline"]
        version = payload.get("version", model_meta.get("version", "1.0.0"))

        try:
            # 4. Execute inference
            if goal == "regression":
                raw_pred = pipeline.predict(features_df)
                raw_val = float(raw_pred[0])
                # Grade clipping policy: bounded strictly to [0.0, 20.0]
                clipped_val = float(np.clip(raw_val, 0.0, 20.0))
                predicted_grade = round(clipped_val, 4)

                return ModelPredictionResult(
                    model_id=model_id,
                    model_version=version,
                    status="success",
                    predicted_grade=predicted_grade,
                    predicted_class=None,
                    error_message=None,
                )
            else:
                raw_pred = pipeline.predict(features_df)
                class_label = str(raw_pred[0])
                if class_label not in ("pass", "fail"):
                    class_label = "pass" if class_label in ("1", "True", "true") else "fail"

                return ModelPredictionResult(
                    model_id=model_id,
                    model_version=version,
                    status="success",
                    predicted_grade=None,
                    predicted_class=class_label,
                    error_message=None,
                )
        except Exception as e:
            # Safe logging of internal exception, sanitize external message
            logger.error("Inference execution failed for model '%s': %s", model_id, str(e))
            return ModelPredictionResult(
                model_id=model_id,
                model_version=version,
                status="failed",
                predicted_grade=None,
                predicted_class=None,
                error_message=f"Inference execution failed for model '{model_id}'.",
            )

    def execute_prediction(self, request: PredictionRequest) -> PredictionResponse:
        """
        Processes single or comparison prediction requests with partial failure handling.
        """
        features_df = self.features_to_dataframe(request.features)
        model_ids = request.model_ids or ([request.model_id] if request.model_id else [])

        results: List[ModelPredictionResult] = []
        for mid in model_ids:
            res = self.predict_model(mid, request.goal, features_df)
            results.append(res)

        # Aggregate overall status
        success_count = sum(1 for r in results if r.status == "success")
        total_count = len(results)

        if success_count == total_count:
            overall_status = "success"
        elif success_count > 0:
            overall_status = "partial_success"
        else:
            overall_status = "failed"

        return PredictionResponse(
            goal=request.goal,
            mode=request.mode,
            status=overall_status,
            results=results,
        )


inference_engine = InferenceEngine()
