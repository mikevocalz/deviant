#!/bin/bash

echo "🚀 Starting Mobile MCP with WebDriverAgent..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || ! grep -q "dvnt" package.json; then
    echo "❌ Error: Must run from Deviant project root"
    echo "💡 Run: cd /Users/mikevocalz/deviant && ./scripts/start-mobile-mcp.sh"
    exit 1
fi

# Kill any existing processes
echo "🔄 Cleaning up existing processes..."
pkill -f "WebDriverAgent" 2>/dev/null || true
pkill -f "expo-mcp" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true

# Wait a moment
sleep 2

# Start Expo dev server (required for MCP)
echo "📦 Starting Expo dev server..."
npx expo start --dev-client &
EXPO_PID=$!

# Wait for Expo to start
echo "⏳ Waiting for Expo server to start (15 seconds)..."
sleep 15

# Check if Expo is running
if ! kill -0 $EXPO_PID 2>/dev/null; then
    echo "❌ Expo dev server failed to start"
    exit 1
fi

# Start MCP with the dev server URL
echo "📱 Starting WebDriverAgent for Mike V. iPhone (00008120-001C31990198201E)..."
npx expo-mcp start --dev-server-url http://localhost:8081 --device 00008120-001C31990198201E &
MCP_PID=$!

# Wait for WebDriverAgent to be ready
echo "⏳ Waiting for WebDriverAgent to initialize (10 seconds)..."
sleep 10

# Check if MCP is still running
if ! kill -0 $MCP_PID 2>/dev/null; then
    echo "❌ WebDriverAgent failed to start"
    echo "🔄 Try unlocking your iPhone and trusting this computer"
    exit 1
fi

# Test connection
echo "🧪 Testing Mobile MCP connection..."
DEVICES=$(mcp1_mobile_list_available_devices 2>/dev/null)

if echo "$DEVICES" | grep -q "00008120-001C31990198201E"; then
    echo ""
    echo "✅ Mobile MCP is ready!"
    echo "📱 Device: Mike V. iPhone (00008120-001C31990198201E)"
    echo "🔧 You can now use mobile MCP functions"
    echo ""
    echo "📋 Available commands:"
    echo "   mcp1_mobile_take_screenshot --device 00008120-001C31990198201E"
    echo "   mcp1_mobile_list_elements_on_screen --device 00008120-001C31990198201E"
    echo "   mcp1_mobile_click_on_screen_at_coordinates --device 00008120-001C31990198201E <x> <y>"
    echo ""
    echo "🔄 Services running in background:"
    echo "   Expo dev server (PID: $EXPO_PID)"
    echo "   WebDriverAgent (PID: $MCP_PID)"
    echo "⚠️  Keep this terminal open or run with nohup"
else
    echo "❌ Mobile MCP setup failed"
    echo "🔍 Debug info:"
    echo "   $DEVICES"
    echo ""
    echo "🛠️  Troubleshooting:"
    echo "   1. Ensure iPhone is unlocked"
    echo "   2. Trust this computer on iPhone"
    echo "   3. Check USB connection"
    echo "   4. Try: npx expo-mcp start --dev-server-url http://localhost:8081 --device 00008120-001C31990198201E"
    exit 1
fi
