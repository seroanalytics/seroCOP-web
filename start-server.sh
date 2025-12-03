#!/bin/bash

# SeroCOP WebR App - Quick Test Script

echo "🚀 SeroCOP WebR App - Test Script"
echo "=================================="
echo ""

# Check if Python is available
if command -v python3 &> /dev/null; then
    echo "✅ Python 3 found"
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    echo "✅ Python found"
    PYTHON_CMD="python"
else
    echo "❌ Python not found. Please install Python to run the server."
    exit 1
fi

echo ""
echo "Starting local web server..."
echo "📍 Server will run at: http://localhost:8000"
echo ""
echo "🔧 Instructions:"
echo "   1. Open http://localhost:8000 in your browser"
echo "   2. Wait for WebR to initialize (1-2 minutes first time)"
echo "   3. Click 'Load Example Data' to test"
echo "   4. Configure model settings"
echo "   5. Click 'Fit Model' and wait for results"
echo ""
echo "⚠️  Notes:"
echo "   - Model fitting may take 2-5 minutes"
echo "   - Use Chrome, Firefox, or Safari (latest versions)"
echo "   - First load downloads ~200MB (cached after)"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
echo "=================================="
echo ""

# Start the server
$PYTHON_CMD -m http.server 8000
