@echo off
echo Installing Python dependencies for NurZeka...
echo.
pip install fastapi uvicorn openai sentence-transformers faiss-cpu python-dotenv requests
echo.
echo Installation complete! 
echo Now run start_rag_system_v2.bat again.
pause
