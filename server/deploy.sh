#!/bin/bash
echo "Deploying to Google Cloud Run..."

PROJECT_ID="aspect-agents"
SERVICE_NAME="avatar-server"
REGION="me-west1"

# Load environment variables from .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "Building and deploying..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --set-env-vars "OPENAI_API_KEY=$OPENAI_API_KEY,ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY"

echo ""
echo "Deployment complete!"
