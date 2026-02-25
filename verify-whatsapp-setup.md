# WhatsApp Business API Setup Verification Guide

## Your Current Situation

✅ Meta Business: **VERIFIED**
❌ WhatsApp Registration: **FAILED**
❓ Phone Certificate: **NOT RELEVANT** (this doesn't affect API registration)

## Why Phone Number Certificate Doesn't Help

A phone number certificate (telecommunications license, business phone registration, etc.) is **not required** and **won't help** with WhatsApp Business API registration. Meta doesn't verify phone ownership through telecom certificates.

What Meta actually checks:
- Meta Business Account verification (you have this ✅)
- WhatsApp Business Account setup (you likely need this ❌)
- Phone number ownership via SMS/call verification
- Proper permissions and account linking

## Step-by-Step: Complete WhatsApp Setup

Since your Meta Business is verified, follow these exact steps:

### Step 1: Add WhatsApp to Your Meta App

1. Go to: https://developers.facebook.com/apps/
2. Click on your app (or create one if you don't have one)
3. In the left sidebar, click "Add Product"
4. Find "WhatsApp" and click "Set Up"
5. You'll see the WhatsApp setup page

### Step 2: Use Embedded Signup (Easiest Method)

This is the recommended way to set up WhatsApp Business API:

1. On the WhatsApp setup page, look for **"Embedded Signup"** section
2. Click **"Get Started"** or **"Start"**
3. You'll see a popup wizard with these steps:

   **Step 2a: Select Business Portfolio**
   - Choose your verified Meta Business account
   - Click "Next"

   **Step 2b: Create WhatsApp Business Account**
   - Name your WhatsApp Business Account (e.g., "Fortuna Customer Service")
   - Click "Next"

   **Step 2c: Add Phone Number**
   - Enter your phone number: `852 9579 8058`
   - Select your country: Hong Kong
   - Click "Next"

   **Step 2d: Verify Phone Number**
   - Choose verification method (SMS or Voice Call)
   - Enter the 6-digit code you receive
   - **This is where your phone gets registered!**

   **Step 2e: Business Profile**
   - Display Name: `Fortuna` (or your preferred name)
   - Category: Choose your business category
   - Description: Brief description of your business
   - Click "Finish"

4. **Done!** Your phone number is now registered with WhatsApp Business API

### Step 3: Get Your Credentials

After completing embedded signup:

1. Go to: https://business.facebook.com/wa/manage/phone-numbers/
2. You should see your phone number listed
3. Click on it to see details:
   - **Phone Number ID**: Copy this (e.g., `958246720713444`)
   - **WhatsApp Business Account ID**: Copy this too

4. Generate Access Token:
   - Go to https://developers.facebook.com/apps/
   - Select your app
   - In the left sidebar: WhatsApp > API Setup
   - Under "Temporary access token", click "Generate Token"
   - **Copy this token** (it's temporary - we'll make it permanent later)

### Step 4: Test in Your Application

Now you can skip the registration API call since your number is already registered:

1. In your application, go to WhatsApp Settings
2. Click "Add WhatsApp Account"
3. Enter the details:
   - **Account Name**: Fortuna WhatsApp
   - **Phone Number ID**: (from Step 3)
   - **Phone Number**: +852 9579 8058
   - **Access Token**: (from Step 3)
   - **Is Active**: Yes

4. Click "Save"

5. Your WhatsApp is now ready to use!

## Alternative: If You Already Did Embedded Signup

If you've already gone through embedded signup and your number shows as registered in Meta Business Manager (https://business.facebook.com/wa/manage/phone-numbers/), then:

### The number is ALREADY registered - Skip the API registration!

Just add it directly to your app:

1. Get your credentials from Meta:
   - Phone Number ID
   - Access Token

2. Add to database manually or via Settings page

3. Start using it for messaging

## Generate Permanent Access Token

The token from the wizard is temporary (24 hours). To make it permanent:

### Method 1: System User Token (Recommended)

1. Go to: https://business.facebook.com/settings/system-users
2. Click "Add" to create a System User
3. Name it (e.g., "WhatsApp API User")
4. Role: Admin
5. Click on the system user you just created
6. Click "Generate New Token"
7. Select your app
8. Select permissions:
   - ✅ `whatsapp_business_management`
   - ✅ `whatsapp_business_messaging`
9. Click "Generate Token"
10. **Copy and save this token** - it's permanent!

### Method 2: Use Existing Token

If you already have a permanent token with WhatsApp permissions, use that.

## Verify Everything is Set Up

Run this cURL command to verify:

```bash
curl -X GET "https://graph.facebook.com/v21.0/YOUR_PHONE_NUMBER_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Expected response if properly set up:
```json
{
  "verified_name": "Fortuna",
  "display_phone_number": "+852 9579 8058",
  "quality_rating": "GREEN",
  "id": "958246720713444"
}
```

If you get this response, everything is configured correctly!

## Common Issues After Meta Business Verification

### Issue 1: "Invalid account linking"

**Cause**: WhatsApp Business Account not created yet
**Solution**: Complete Embedded Signup (Step 2 above)

### Issue 2: "Phone number already registered elsewhere"

**Cause**: Number is registered in a different Meta Business Account
**Solution**:
- Find which account has it: https://business.facebook.com/wa/manage/phone-numbers/
- Either use that account, or migrate the number

### Issue 3: "Insufficient permissions"

**Cause**: Access token doesn't have WhatsApp permissions
**Solution**: Generate new token with correct permissions (see "Generate Permanent Access Token" above)

## Summary of What You Need

Since your Meta Business is verified, you need to:

1. ✅ Complete Embedded Signup to create WhatsApp Business Account
2. ✅ This will register your phone number automatically
3. ✅ Get Phone Number ID and Access Token
4. ✅ Add to your application settings
5. ✅ Skip the API registration call - it's already done!

The phone certificate you mentioned is not used in this process. Meta verifies phone ownership via SMS/call during embedded signup.

## Next Steps

1. Go to https://developers.facebook.com/apps/
2. Add WhatsApp product if not already added
3. Click "Embedded Signup" and follow the wizard
4. Enter your phone number `852 9579 8058` when prompted
5. Verify it with the SMS code
6. Get your Phone Number ID and Access Token
7. Add them to your application

Your number will be registered automatically during this process - no need to call the registration API!
