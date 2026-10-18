"""
Classroom Insight — ML Service Configuration
Externalized configuration with environment variable overrides.
"""

import os
from pathlib import Path
from pydantic import BaseModel, Field


def _resolve_default_artifacts_dir() -> str:
    env_dir = os.environ.get("ARTIFACTS_DIR")
    if env_dir:
        return env_dir
    cwd_path = Path("ml-service/artifacts")
    if cwd_path.exists():
        return str(cwd_path.resolve())
    local_path = Path("artifacts")
    if local_path.exists():
        return str(local_path.resolve())
    parent_path = Path(__file__).resolve().parent.parent / "artifacts"
    return str(parent_path)


def _resolve_default_schema_path() -> str:
    env_path = os.environ.get("SCHEMA_PATH")
    if env_path:
        return env_path
    cwd_path = Path("docs/feature_schema.json")
    if cwd_path.exists():
        return str(cwd_path.resolve())
    parent_path = Path(__file__).resolve().parent.parent.parent / "docs" / "feature_schema.json"
    if parent_path.exists():
        return str(parent_path.resolve())
    return "docs/feature_schema.json"


class Settings(BaseModel):
    service_name: str = "Classroom Insight ML Inference Service"
    service_version: str = "1.0.0"
    artifacts_dir: str = Field(default_factory=_resolve_default_artifacts_dir)
    registry_path: str = Field(
        default_factory=lambda: os.environ.get(
            "REGISTRY_PATH",
            str(Path(_resolve_default_artifacts_dir()) / "model_registry.json"),
        )
    )
    evaluation_report_path: str = Field(
        default_factory=lambda: os.environ.get(
            "EVALUATION_REPORT_PATH",
            str(Path(_resolve_default_artifacts_dir()) / "evaluation_report.json"),
        )
    )
    schema_path: str = Field(default_factory=_resolve_default_schema_path)
    host: str = Field(default_factory=lambda: os.environ.get("HOST", "0.0.0.0"))
    port: int = Field(default_factory=lambda: int(os.environ.get("PORT", "8000")))


settings = Settings()
