"""Shared configuration for the local email-summary model."""

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = PROJECT_ROOT / "Models"
REPO_ID = "Qwen/Qwen3-8B-GGUF"
MODEL_FILE = "Qwen3-8B-Q4_K_M.gguf"
MODEL_PATH = MODEL_DIR / MODEL_FILE
