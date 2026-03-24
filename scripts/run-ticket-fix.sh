#!/bin/bash
# Execute ticket user_id fix via edge function

echo "🔧 Running ticket user_id fix..."

response=$(curl -s -X POST "https://npfjanxturvmjyevoyfo.supabase.co/functions/v1/fix-tickets" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmphbnh0dXJ2bWp5ZXZveWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjA0MjMsImV4cCI6MjA4Mzk5NjQyM30.v88MMGqv2db8hn8llr5aToKbKUDOHz-AxZbZYA5RLGM")

echo "$response" | jq .

if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
    echo ""
    echo "✅ Ticket fix completed successfully!"
    updated=$(echo "$response" | jq -r '.updated')
    echo "📊 Updated $updated tickets"
else
    echo ""
    echo "❌ Fix failed - check response above"
    exit 1
fi
