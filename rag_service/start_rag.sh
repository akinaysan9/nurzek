#!/bin/bash
cd /www/wwwroot/nurzek/rag_service
export PYTHONPATH=/www/wwwroot/nurzek/venv/lib/python3.11/site-packages:/www/wwwroot/nurzek/rag_service
exec /usr/bin/python3 -m uvicorn app:app --host 0.0.0.0 --port 8000 --workers 1
