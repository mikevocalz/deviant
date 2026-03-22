# Google Places API Setup Guide

## 🚨 **URGENT: Autocomplete Not Working**

The location autocomplete is currently not working because the Google Places API key is invalid. Here's how to fix it:

## **Quick Fix Steps**

### 1. **Get a Real Google Places API Key**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable these APIs:
   - **Places API**
   - **Maps SDK for Android** 
   - **Maps SDK for iOS**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy the API key

### 2. **Update Environment Variables**

Replace the placeholder API key in `.env`:

```bash
# Current (INVALID):
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=YOUR_GOOGLE_PLACES_API_KEY_HERE

# Replace with your REAL API key:
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=YOUR_REAL_API_KEY_HERE
```

### 3. **Restart the App**

```bash
# Kill the current dev server
pkill -f expo

# Restart with fresh environment
EXPO_UNSTABLE_MCP_SERVER=1 npx expo start --dev-client --port 8082
```

## **Verification**

Test the autocomplete by:
1. Open Create Post or Edit Post screen
2. Tap in the location field
3. Type "Madison Square Garden"
4. Should see dropdown with predictions

## **Current Status**

✅ **Implementation Complete**: All 4 screens use LocationAutocomplete
❌ **API Key Invalid**: Need real Google Places API key
🔄 **Fallback Mode**: Manual text input working

## **API Key Requirements**

- Must have **Places API** enabled
- Must have **Maps SDK** enabled (for future map features)
- Should be restricted to your app's bundle ID for security
- No billing required for development usage limits

## **Security Notes**

- Never commit real API keys to git
- Use environment variables (EXPO_PUBLIC_*)
- Consider restricting API key to app bundle ID in production

---

**Once you add a real API key, the autocomplete will work immediately!**
