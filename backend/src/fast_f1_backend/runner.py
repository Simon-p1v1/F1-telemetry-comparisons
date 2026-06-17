import os

import uvicorn

from fast_f1_backend.config import settings


def run() -> None:
    """Run the API with visible startup output.

    This is intentionally tiny so local startup is obvious and production can still
    use `uvicorn fast_f1_backend.main:app` directly if desired.
    """
    print(
        "\n".join(
            [
                f"Starting {settings.app_name}",
                f"Host:       {settings.host}",
                f"Port:       {settings.port}",
                f"API:        http://{settings.host_for_url}:{settings.port}",
                f"Docs:       http://{settings.host_for_url}:{settings.port}/docs",
                f"Cache dir:  {settings.cache_dir}",
                f"Reload:     {settings.reload}",
                "Press CTRL+C to stop.",
            ]
        ),
        flush=True,
    )

    uvicorn.run(
        "fast_f1_backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower(),
        access_log=True,
    )


if __name__ == "__main__":
    # Lets `python src/fast_f1_backend/runner.py` work after editable install,
    # and `python -m fast_f1_backend.runner` / console script work normally.
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    run()
