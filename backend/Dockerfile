# Backend image for Railway (and any other container host).
#
# Every dependency in requirements.txt ships a cp312 manylinux wheel —
# including scikit-learn and hdbscan — so the slim base needs no compiler.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies first so a code-only change reuses the install layer.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Railway injects PORT; 8000 is the local default. Single worker on purpose —
# progress.py's job registry is in-memory, so a second worker would serve
# "job not found" for half the polls. See docs/deploy-railway.md.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
