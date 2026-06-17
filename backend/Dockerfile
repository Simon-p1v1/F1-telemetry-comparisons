FROM python:3.11-slim AS build

WORKDIR /app
COPY pyproject.toml README.md* ./
COPY src/ src/

RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir .

FROM python:3.11-slim

WORKDIR /app
COPY --from=build /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=build /usr/local/bin /usr/local/bin
COPY --from=build /app/src /app/src

ENV PYTHONPATH=/app/src

EXPOSE 8000
CMD ["uvicorn", "fast_f1_backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
