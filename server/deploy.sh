#!/bin/bash
echo "Deploying to Google Cloud Run..."

PROJECT_ID="aspect-agents"
SERVICE_NAME="avatar-server"
REGION="me-west1"
CLEANUP_OLD_REVISIONS=false
REVISION_SUFFIX=""

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --cleanup) CLEANUP_OLD_REVISIONS=true ;;
    --suffix=*) REVISION_SUFFIX="${1#*=}" ;;
    --suffix) REVISION_SUFFIX="$2"; shift ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# Load environment variables from .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Build deploy command
DEPLOY_CMD="gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --set-env-vars OPENAI_API_KEY=$OPENAI_API_KEY,ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY,ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"

# Add revision suffix if provided
if [ -n "$REVISION_SUFFIX" ]; then
  DEPLOY_CMD="$DEPLOY_CMD --revision-suffix=$REVISION_SUFFIX"
  echo "Using revision suffix: $REVISION_SUFFIX"
fi

echo "Building and deploying..."
eval $DEPLOY_CMD

# Clean up old revisions if flag is set
if [ "$CLEANUP_OLD_REVISIONS" = true ]; then
  echo ""
  echo "Cleaning up old revisions..."

  # Get the current serving revision
  CURRENT_REVISION=$(gcloud run services describe $SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format="value(status.traffic.revisionName)" \
    2>/dev/null)

  echo "Current serving revision: $CURRENT_REVISION"

  # Get all revisions and delete those that aren't serving traffic
  ALL_REVISIONS=$(gcloud run revisions list \
    --service=$SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format="value(name)" \
    2>/dev/null)

  for revision in $ALL_REVISIONS; do
    if [ "$revision" != "$CURRENT_REVISION" ]; then
      echo "Deleting old revision: $revision"
      gcloud run revisions delete $revision \
        --region=$REGION \
        --project=$PROJECT_ID \
        --quiet
    fi
  done

  echo "Cleanup complete."
fi

echo ""
echo "Deployment complete!"
