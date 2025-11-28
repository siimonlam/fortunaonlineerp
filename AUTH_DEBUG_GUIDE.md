# Auth Debugging Guide

## What Was Changed

### 1. Removed All Auto-Redirects
- No automatic OAuth triggers
- No automatic redirects when session is missing
- User MUST click "Continue with Google" button manually

### 2. Added Comprehensive Debug Logging

All auth events now log with `[AuthProvider]` or `[AppContent]` or `[LoginPage]` prefixes.

## Debug Log Guide

### On Initial Page Load (Not Logged In)

You should see:
```
=== AUTH DEBUG START ===
Current URL: https://fortunaerp.vercel.app/
URL Search:
URL Hash:
URL Pathname: /
=== AUTH DEBUG END ===
[AuthProvider] Getting initial session...
[AuthProvider] Initial session result: No user
[AppContent] Render - loading: true | user: null | pathname: /
[AppContent] Render - loading: false | user: null | pathname: /
[LoginPage] Rendered
```

**This is NORMAL and NOT a loop** - these logs appear once on mount.

### When User Clicks "Continue with Google"

You should see:
```
[LoginPage] handleGoogleSignIn called
[AuthProvider] signInWithGoogle called
[AuthProvider] Redirect URL: https://fortunaerp.vercel.app
[AuthProvider] OAuth redirect initiated (you will be redirected to Google)
[LoginPage] signInWithGoogle completed (should redirect to Google now)
```

Then browser redirects to Google OAuth page.

### When User Returns After Google OAuth Success

You should see:
```
=== AUTH DEBUG START ===
Current URL: https://fortunaerp.vercel.app/?code=XXXXX
URL Search: ?code=XXXXX
URL Hash:
URL Pathname: /
=== AUTH DEBUG END ===
[AuthProvider] Getting initial session...
[AuthProvider] Initial session result: user@example.com  <-- USER EMAIL HERE
[AuthProvider] Auth state changed: SIGNED_IN
[AuthProvider] Session user: user@example.com
[AuthProvider] User signed in successfully
[AuthProvider] Cleaning OAuth params from URL
[AppContent] Render - loading: false | user: user@example.com | pathname: /
```

Then ProjectBoard should load.

## How to Identify an Infinite Loop

An infinite loop will show:
- The same logs repeating over and over (every second)
- `=== AUTH DEBUG START ===` appearing multiple times continuously
- Browser tab showing constant "loading" indicator
- Network tab showing repeated requests

## What to Check If Still Looping

1. **Check Console for Repeated Logs**
   - Look for `=== AUTH DEBUG START ===` appearing more than once
   - Count how many times `[AuthProvider] Getting initial session...` appears

2. **Check Network Tab**
   - Are there repeated requests to Supabase?
   - Is there a redirect loop (back and forth)?

3. **Check URL Parameters**
   - Does the URL keep changing?
   - Are there any error parameters like `?error=...`?

4. **Check for JavaScript Errors**
   - Open Console and look for red errors
   - Any uncaught exceptions?

## Supabase Configuration Required

### In Supabase Dashboard
https://supabase.com/dashboard/project/yostyonvexbzlgedbfgq/auth/url-configuration

- **Site URL**: `https://fortunaerp.vercel.app`
- **Redirect URLs**: `https://fortunaerp.vercel.app/**`

### In Google Cloud Console
Keep ONLY:
- `https://yostyonvexbzlgedbfgq.supabase.co/auth/v1/callback`

DO NOT add your Vercel URLs to Google Cloud Console.

## Expected Behavior

1. User loads app → sees LoginPage (logs appear ONCE)
2. User clicks "Continue with Google" → redirects to Google
3. User approves → redirects back to app with auth code
4. App exchanges code for session → ProjectBoard loads
5. No loops, no repeated redirects

If logs appear more than once without user action, that's a loop and needs investigation.
