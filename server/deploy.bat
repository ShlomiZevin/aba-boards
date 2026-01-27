@echo off
setlocal enabledelayedexpansion
echo Deploying to Google Cloud Run...

set PROJECT_ID=1018338671074
set SERVICE_NAME=avatar-server
set REGION=me-west1
set CLEANUP_OLD_REVISIONS=false
set REVISION_SUFFIX=

:: Parse command line arguments
:parse_args
if "%~1"=="" goto done_args
if "%~1"=="--cleanup" (
  set CLEANUP_OLD_REVISIONS=true
  shift
  goto parse_args
)
if "%~1"=="--suffix" (
  set REVISION_SUFFIX=%~2
  shift
  shift
  goto parse_args
)
echo Unknown parameter: %~1
exit /b 1
:done_args

echo Loading environment variables from .env...
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
  if not "%%a"=="" if not "%%a:~0,1%"=="#" set "%%a=%%b"
)

:: Build deploy command
set DEPLOY_CMD=gcloud run deploy %SERVICE_NAME% --source . --region %REGION% --project %PROJECT_ID% --allow-unauthenticated --set-env-vars "OPENAI_API_KEY=%OPENAI_API_KEY%,ELEVENLABS_API_KEY=%ELEVENLABS_API_KEY%"

:: Add revision suffix if provided
if not "%REVISION_SUFFIX%"=="" (
  set DEPLOY_CMD=%DEPLOY_CMD% --revision-suffix=%REVISION_SUFFIX%
  echo Using revision suffix: %REVISION_SUFFIX%
)

echo Building and deploying...
%DEPLOY_CMD%

:: Clean up old revisions if flag is set
if "%CLEANUP_OLD_REVISIONS%"=="true" (
  echo.
  echo Cleaning up old revisions...

  :: Get the current serving revision
  for /f "tokens=*" %%r in ('gcloud run services describe %SERVICE_NAME% --region=%REGION% --project=%PROJECT_ID% --format="value(status.traffic.revisionName)" 2^>nul') do (
    set CURRENT_REVISION=%%r
  )

  echo Current serving revision: !CURRENT_REVISION!

  :: Get all revisions and delete those that aren't serving traffic
  for /f "tokens=*" %%r in ('gcloud run revisions list --service=%SERVICE_NAME% --region=%REGION% --project=%PROJECT_ID% --format="value(name)" 2^>nul') do (
    if not "%%r"=="!CURRENT_REVISION!" (
      echo Deleting old revision: %%r
      gcloud run revisions delete %%r --region=%REGION% --project=%PROJECT_ID% --quiet
    )
  )

  echo Cleanup complete.
)

echo.
echo Deployment complete!
pause
