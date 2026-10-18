"""
Classroom Insight — ML Model Artifact Loader
Loads serialized pipelines and evaluation metadata safely from disk.
Guarantees NO online training or retraining occurs during startup or runtime.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
import joblib

from .config import settings
from .schemas import ModelInfo, ModelPerformanceItem, PerformanceResponse

logger = logging.getLogger("classroom_insight.loader")


class ModelLoader:
    """
    Manages loading and caching of pre-trained model artifacts,
    the model registry, and offline evaluation reports.
    """

    def __init__(
        self,
        artifacts_dir: Optional[str] = None,
        registry_path: Optional[str] = None,
        evaluation_report_path: Optional[str] = None,
    ):
        self.artifacts_dir = artifacts_dir or settings.artifacts_dir
        self.registry_path = registry_path or settings.registry_path
        self.evaluation_report_path = (
            evaluation_report_path or settings.evaluation_report_path
        )

        self.models: Dict[str, Dict[str, Any]] = {}
        self.registry: List[Dict[str, Any]] = []
        self.registry_by_id: Dict[str, Dict[str, Any]] = {}
        self.evaluation_report: Dict[str, Any] = {}
        self.load_errors: Dict[str, str] = {}
        self.is_healthy: bool = False

    def load_artifacts(self) -> bool:
        """
        Loads all required assets into memory.
        Returns True if all expected artifacts and metadata loaded successfully.
        """
        self.models.clear()
        self.registry.clear()
        self.registry_by_id.clear()
        self.evaluation_report.clear()
        self.load_errors.clear()
        self.is_healthy = False

        # 1. Load Model Registry
        if not os.path.exists(self.registry_path):
            msg = f"Model registry file not found: {self.registry_path}"
            logger.error(msg)
            self.load_errors["registry"] = msg
            return False

        try:
            with open(self.registry_path, "r", encoding="utf-8") as f:
                self.registry = json.load(f)
            self.registry_by_id = {m["model_id"]: m for m in self.registry}
            logger.info("Loaded model registry with %d entries", len(self.registry))
        except Exception as e:
            msg = f"Failed to parse model registry: {e}"
            logger.error(msg)
            self.load_errors["registry"] = msg
            return False

        # 2. Load Evaluation Report
        if not os.path.exists(self.evaluation_report_path):
            msg = f"Evaluation report file not found: {self.evaluation_report_path}"
            logger.error(msg)
            self.load_errors["evaluation_report"] = msg
        else:
            try:
                with open(self.evaluation_report_path, "r", encoding="utf-8") as f:
                    self.evaluation_report = json.load(f)
                logger.info("Loaded evaluation report")
            except Exception as e:
                msg = f"Failed to parse evaluation report: {e}"
                logger.error(msg)
                self.load_errors["evaluation_report"] = msg

        # 3. Load Model Artifacts
        expected_models_count = len(self.registry)
        for model_meta in self.registry:
            model_id = model_meta["model_id"]
            artifact_file = model_meta.get("artifact_file", f"{model_id}.joblib")
            artifact_path = os.path.join(self.artifacts_dir, artifact_file)

            if not os.path.exists(artifact_path):
                msg = f"Artifact file missing for model '{model_id}': {artifact_path}"
                logger.error(msg)
                self.load_errors[model_id] = msg
                continue

            try:
                payload = joblib.load(artifact_path)
                if not isinstance(payload, dict) or "pipeline" not in payload:
                    msg = f"Invalid artifact structure for model '{model_id}' (missing pipeline dictionary)"
                    logger.error(msg)
                    self.load_errors[model_id] = msg
                    continue

                self.models[model_id] = payload
                logger.info("Loaded model '%s' (task: %s)", model_id, payload.get("task"))
            except Exception as e:
                msg = f"Failed to deserialize artifact for model '{model_id}': {e}"
                logger.error(msg)
                self.load_errors[model_id] = msg

        # Healthy only if:
        # - registry loaded
        # - evaluation report loaded
        # - all registered models (at least 10 expected) loaded with no errors
        if (
            len(self.load_errors) == 0
            and len(self.models) == expected_models_count
            and expected_models_count >= 10
            and bool(self.evaluation_report)
        ):
            self.is_healthy = True
        else:
            self.is_healthy = False
            logger.warning(
                "Model loader degraded or down. Loaded %d of %d models. Errors: %s",
                len(self.models),
                expected_models_count,
                list(self.load_errors.keys()),
            )

        # Force immediate garbage collection of temporary deserialization buffers
        import gc
        gc.collect()

        return self.is_healthy

    @property
    def models_loaded_count(self) -> int:
        return len(self.models)

    def get_model_payload(self, model_id: str) -> Optional[Dict[str, Any]]:
        return self.models.get(model_id)

    def get_model_metadata(self, model_id: str) -> Optional[Dict[str, Any]]:
        return self.registry_by_id.get(model_id)

    def list_models_for_goal(self, goal: str) -> List[ModelInfo]:
        """
        Returns loaded models compatible with the requested goal.
        """
        results: List[ModelInfo] = []
        for model_meta in self.registry:
            if model_meta.get("task") == goal:
                model_id = model_meta["model_id"]
                # Verify that the model artifact is actually loaded
                if model_id in self.models:
                    results.append(
                        ModelInfo(
                            model_id=model_id,
                            name=model_meta["name"],
                            family=model_meta["family"],
                            version=model_meta.get("version", "1.0.0"),
                            status=model_meta.get("status", "available"),
                            description=model_meta["description"],
                            selected_primary_candidate=model_meta.get(
                                "selected_primary_candidate", False
                            ),
                        )
                    )
        return results

    def get_performance_for_goal(self, goal: str) -> PerformanceResponse:
        """
        Returns genuine performance metrics from evaluation report for the given goal.
        """
        if not self.evaluation_report:
            raise RuntimeError("Evaluation report is unavailable")

        meta = self.evaluation_report.get("metadata", {})
        dataset_info = meta.get("dataset", {})
        ds_name = dataset_info.get("name", "UCI Student Performance - Mathematics")
        ds_filename = dataset_info.get("filename", "student-mat.csv")
        dataset_name = f"{ds_name} ({ds_filename})" if ds_filename and ds_filename not in ds_name else ds_name
        split_info = meta.get("split", {})
        test_samples = split_info.get("test_samples", 79)
        generated_at = meta.get("generated_at", "")

        if goal == "regression":
            eval_strategy = "Held-out test set (80/20 split), CV (5-fold) on train set"
            raw_models = self.evaluation_report.get("regression_models", {})
        else:
            eval_strategy = (
                "Held-out test set (80/20 stratified split), CV (5-fold) on train set"
            )
            raw_models = self.evaluation_report.get("classification_models", {})

        model_items: List[ModelPerformanceItem] = []
        for model_id, model_data in raw_models.items():
            test_metrics = model_data.get("test_metrics", {})
            # For regression, the canonical reported metrics are the clipped ones
            if goal == "regression" and "clipped" in test_metrics:
                metrics_to_use = test_metrics["clipped"]
            else:
                metrics_to_use = test_metrics

            model_status = "evaluated" if bool(metrics_to_use) else "unevaluated"

            model_items.append(
                ModelPerformanceItem(
                    model_id=model_id,
                    name=model_data.get("name", model_id),
                    version=model_data.get("version", "1.0.0"),
                    status=model_status,
                    metrics=metrics_to_use,
                    cv_metrics=model_data.get("cv_metrics"),
                )
            )

        return PerformanceResponse(
            goal=goal,
            dataset=dataset_name,
            evaluation_strategy=eval_strategy,
            test_sample_count=test_samples,
            generated_at=generated_at,
            models=model_items,
        )


# Global singleton instance for application runtime
loader = ModelLoader()
