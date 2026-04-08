#!/bin/bash

# Navigate to the correct folder
cd "$(dirname "$0")"

echo "================================================="
echo "   Starting CardComposer (Split Architecture)    "
echo "================================================="

# Find our local IP address (works on Mac and Linux)
LOCAL_IP=$(ifconfig | grep "inet " | grep -Fv 127.0.0.1 | awk '{print $2}' | head -n 1)

PORT_API=9902
PORT_APP=9901

echo "⚙️  Starting Backend API Server on port $PORT_API..."
# Start the Node.js API server in the background
npm run server > /dev/null &
API_PID=$!

echo "🎨 Starting Frontend Main App on port $PORT_APP..."

# Cleanup trap to kill API server when we exit
trap 'kill $API_PID; echo -e "\n🛑 Servers stopped."; exit' INT TERM EXIT

echo ""
echo "✅ Both servers gracefully running!"
echo "   Access your Main App from anywhere on your WiFi network:"
echo ""
echo "👉 Local access:   http://localhost:$PORT_APP"
if [ ! -z "$LOCAL_IP" ]; then
    echo "👉 Network access: http://$LOCAL_IP:$PORT_APP"
fi
echo "================================================="
echo "(Press CTRL+C to stop both servers)"
echo ""

# Start the Vite React app exposed on the local network (blocks terminal)
npm run dev -- --clearScreen false
