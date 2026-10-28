# Production Dockerfile for Rung (RADIX Talent Match Engine)
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code, data, and static assets
COPY app/ ./app/
COPY data/ ./data/
COPY demo.py .
COPY README.md .

# Ensure directory for saved candidate profiles exists
RUN mkdir -p profiles

# Set environment
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

# Start Uvicorn server
CMD ["uvicorn", "app.api:app", "--host", "0.0.0.0", "--port", "8000"]
