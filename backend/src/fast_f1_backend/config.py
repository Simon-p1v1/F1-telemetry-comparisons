from dataclasses import dataclass
import os
from pathlib import Path


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_name: str = "Fast-F1 Backend"
    host: str = os.getenv("HOST", "127.0.0.1")
    port: int = int(os.getenv("PORT", "8000"))
    reload: bool = _env_bool("RELOAD", False)
    log_level: str = os.getenv("LOG_LEVEL", "info")
    cache_dir: Path = Path(os.getenv("FASTF1_CACHE_DIR", ".cache/fastf1"))
    session_cache_size: int = int(os.getenv("SESSION_CACHE_SIZE", "16"))

    @property
    def host_for_url(self) -> str:
        return "localhost" if self.host in {"0.0.0.0", "::"} else self.host


settings = Settings()
