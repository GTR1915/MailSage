"""Download the Qwen GGUF model used by the email summarizer."""

from pathlib import Path

from huggingface_hub import hf_hub_download

from model_config import MODEL_DIR, MODEL_FILE, MODEL_PATH, REPO_ID


def download_model() -> Path:
    """Download the model once and return its local path."""
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.exists():
        print(f"Model already exists: {MODEL_PATH}")
        return MODEL_PATH

    print("Qwen3-8B Q4_K_M is not installed.")
    print("Downloading model (approximately 5 GB)...")
    downloaded_path = Path(hf_hub_download(repo_id=REPO_ID, filename=MODEL_FILE, local_dir=MODEL_DIR))
    print(f"Model downloaded to: {downloaded_path}")
    return downloaded_path


if __name__ == "__main__":
    download_model()
