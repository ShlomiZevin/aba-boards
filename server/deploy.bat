@echo off
echo Deploying to Google Cloud Run...

set PROJECT_ID=1018338671074
set SERVICE_NAME=avatar-server
set REGION=me-west1

echo Loading environment variables from .env...
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
  if not "%%a"=="" if not "%%a:~0,1%"=="#" set "%%a=%%b"
)

echo Building and deploying...
gcloud run deploy %SERVICE_NAME% ^
  --source . ^
  --region %REGION% ^
  --project %PROJECT_ID% ^
  --allow-unauthenticated ^
  --set-env-vars "OPENAI_API_KEY=%OPENAI_API_KEY%,ELEVENLABS_API_KEY=%ELEVENLABS_API_KEY%"

echo.
echo Deployment complete!
pause
