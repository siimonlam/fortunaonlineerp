# WhatsApp Registration Troubleshooting Guide

## Common Registration Errors and Solutions

### Error: "Failed to register with WhatsApp API" (400 Bad Request)

This is the most common error. Here are the possible causes and solutions:

#### 1. Phone Number Already Registered

**Error Message**: `"The phone number has already been registered"`

**Cause**: You're trying to register a phone number that's already registered in WhatsApp Business API.

**Solution**:
- Check if the number is already registered in Meta Business Manager
- If you need to re-register, first unregister it via Meta Business Manager or API:
  ```bash
  POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/deregister
  Authorization: Bearer {ACCESS_TOKEN}
  Content-Type: application/json

  {
    "pin": "your-6-digit-pin"
  }
  ```
- Then try registering again

#### 2. Invalid Access Token

**Error Message**: `"Invalid OAuth access token"` or `"Token is expired"`

**Cause**: The access token is invalid, expired, or doesn't have proper permissions.

**Solution**:
1. Generate a new access token in Meta Business Manager
2. Ensure the token has these permissions:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
3. Use a **Permanent Access Token** (not a temporary one)
4. To generate a permanent token:
   - Go to Meta Business Settings
   - Navigate to System Users
   - Create a System User with WhatsApp permissions
   - Generate a permanent token for that user

#### 3. Invalid Phone Number ID

**Error Message**: `"Invalid parameter"` or `"Phone number not found"`

**Cause**: The Phone Number ID is incorrect.

**Solution**:
1. Go to Meta Business Manager
2. Navigate to WhatsApp > API Setup
3. Copy the **Phone Number ID** (this is NOT the actual phone number)
4. It should look like: `123456789012345` (a long number)

**Example**:
- Phone Number: `+852 9579 8058` (what you dial)
- Phone Number ID: `958246720713444` (Meta's internal ID) ✓ Use this one

#### 4. Two-Step Verification Enabled

**Error Message**: `"Two-step verification is required"`

**Cause**: The WhatsApp Business Account has two-step verification (2FA) enabled.

**Solution**:
1. You need to disable 2FA temporarily OR
2. Use the 2FA PIN instead of the 6-digit registration PIN
3. To disable 2FA:
   - Open WhatsApp Business app
   - Go to Settings > Account > Two-step verification
   - Turn off
   - Try registering again

#### 5. Incorrect PIN Format

**Error Message**: `"Invalid PIN"`

**Cause**: The PIN is not exactly 6 digits.

**Solution**:
- Ensure the PIN is exactly 6 digits
- No spaces or special characters
- Only numbers 0-9
- Example: `187054` ✓ Correct

#### 6. Meta Business Account Not Verified

**Error Message**: `"Business verification required"`

**Cause**: Your Meta Business Account needs to be verified.

**Solution**:
1. Go to Meta Business Settings
2. Complete business verification
3. This may require:
   - Business documents
   - Tax ID
   - Business address verification
4. Wait for Meta to approve (can take 1-3 business days)

#### 7. Insufficient Permissions

**Error Message**: `"Insufficient permissions"` or `"Access denied"`

**Cause**: The access token doesn't have permission to manage this phone number.

**Solution**:
1. Ensure the token's associated user/app has been granted access to the WhatsApp Business Account
2. In Meta Business Settings:
   - Go to WhatsApp Accounts
   - Click on your account
   - Ensure the app/system user is added with proper permissions
3. Permissions needed:
   - Manage phone numbers
   - Send messages
   - Read messages

## How to Debug

### Step 1: Check the Browser Console

After clicking "Register Number", open the browser console (F12) and look for error messages. The detailed Meta API response will be logged there.

### Step 2: Test with cURL

Test the registration directly with cURL to isolate the issue:

```bash
curl -X POST "https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/register" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "pin": "123456"
  }'
```

Replace:
- `{PHONE_NUMBER_ID}` with your actual Phone Number ID
- `{ACCESS_TOKEN}` with your access token

### Step 3: Verify Phone Number Status

Check if the phone number is already registered:

```bash
curl -X GET "https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}?fields=verified_name,display_phone_number,quality_rating" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

### Step 4: Check Token Permissions

Verify your access token:

```bash
curl -X GET "https://graph.facebook.com/v21.0/me?access_token={ACCESS_TOKEN}"
```

## Working Example

Here's a complete working example with the correct values:

```javascript
// Registration Form Values
{
  "phone_number_id": "958246720713444",        // From Meta Business Manager
  "pin": "187054",                              // Your 6-digit PIN
  "access_token": "EAAHBn3uBsBOZC...",         // Permanent token from Meta
  "display_name": "Fortuna Customer Support",   // Friendly name
  "phone_number": "+852 9579 8058",            // Actual phone number
  "meta_business_account_id": "123456789"      // Optional
}
```

## Still Having Issues?

1. **Check Meta Business Manager Status**:
   - Ensure your WhatsApp Business Account is active
   - Check for any alerts or warnings in Meta Business Manager

2. **Verify API Version**:
   - The system uses v21.0 of the Graph API
   - Ensure this version supports your use case

3. **Rate Limits**:
   - Meta has rate limits on API calls
   - If you've tried multiple times, wait 5-10 minutes

4. **Contact Meta Support**:
   - If none of the above works, contact Meta Business Support
   - Provide them with your Business Manager ID and Phone Number ID

## Alternative: Skip Registration (Already Registered)

If your number is **already registered** via another method (Meta Business Manager UI, another app, etc.), you can skip the registration step and just add the phone number details manually:

1. Go to your database
2. Insert directly into `whatsapp_phone_numbers` table:
   ```sql
   INSERT INTO whatsapp_phone_numbers (
     phone_number_id,
     phone_number,
     display_name,
     verified_status,
     quality_rating,
     access_token,
     is_active
   ) VALUES (
     '958246720713444',
     '+852 9579 8058',
     'Fortuna',
     'verified',
     'green',
     'YOUR_ACCESS_TOKEN',
     true
   );
   ```

This will allow you to use the messaging features without going through the registration API call.

## Need Help?

If you're still experiencing issues, please provide:
- The exact error message from the browser console
- Your Phone Number ID (first/last 4 digits only)
- Whether the number was previously registered
- Your Meta Business Account verification status

This will help diagnose the specific issue you're facing.
