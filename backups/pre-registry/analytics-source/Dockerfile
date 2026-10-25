FROM python:3.12-slim
WORKDIR /app
COPY services/analytics/requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock && useradd -u 1654 -m app && mkdir -p /data && chown app /data
COPY services/analytics/main.py .
USER app
ENV DATA_DIR=/data
HEALTHCHECK --interval=20s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8091/health')"
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8091"]
