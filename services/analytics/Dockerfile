FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-writer && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY services/analytics/requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock && useradd -u 1654 -m app && mkdir -p /data && chown app /data
COPY services/analytics/main.py services/analytics/registry.py services/analytics/geocoding.py services/analytics/word_import.py ./
COPY services/analytics/geodata/ ./geodata/
USER app
ENV DATA_DIR=/data
HEALTHCHECK --interval=20s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8091/health')"
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8091"]
