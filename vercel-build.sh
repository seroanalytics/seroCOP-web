#!/bin/bash
# Vercel build script - replaces __API_URL__ with environment variable

# Replace placeholder with actual API URL from environment
if [ -n "$API_URL" ]; then
  echo "Replacing API URL with: $API_URL"
  sed -i "s|__API_URL__|$API_URL|g" app.js
else
  echo "Warning: API_URL environment variable not set"
fi
