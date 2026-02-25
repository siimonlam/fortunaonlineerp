# How to Find WhatsApp Embedded Signup (Updated 2025)

## The Problem

Meta has changed the WhatsApp Business API interface multiple times. "Embedded Signup" might not be labeled as such anymore.

## What You're Actually Looking For

You need to find the **"Add Phone Number"** flow in WhatsApp Manager. This is what used to be called "Embedded Signup."

## Method 1: Direct WhatsApp Manager (Recommended)

This is the easiest way:

### Step 1: Go to WhatsApp Manager
URL: **https://business.facebook.com/wa/manage/home/**

### Step 2: What You'll See

You'll see one of these scenarios:

#### Scenario A: You Have NO Phone Numbers Yet
- You'll see a welcome screen or getting started page
- Look for buttons like:
  - **"Add a phone number"**
  - **"Get started with WhatsApp"**
  - **"Start using WhatsApp API"**
- Click any of these buttons

#### Scenario B: You Already Have Phone Numbers
- You'll see a list of phone numbers
- Look in the **top-right corner** for:
  - **"Add phone number"** button (usually green)
  - Or a **"+"** icon
- Click it

### Step 3: Choose Phone Number Type
You'll see options:
1. **"Use a phone number you already have"** ← SELECT THIS
2. "Get a new number from Meta"

Click option 1.

### Step 4: Follow the Wizard
1. Enter your phone: `+852 9579 8058`
2. Choose verification method: SMS or Call
3. Enter 6-digit code
4. Set business display name
5. Done!

## Method 2: Through Your Meta App

### Step 1: Go to Meta Apps
URL: **https://developers.facebook.com/apps/**

### Step 2: Create or Select App

#### If You Don't Have an App:
1. Click **"Create App"**
2. Choose app type: **"Business"**
3. Give it a name (e.g., "Fortuna WhatsApp")
4. Connect to your verified Business Manager
5. Click "Create App"

#### If You Have an App:
1. Click on your app name

### Step 3: Add WhatsApp Product

Look in the left sidebar:
- If you see **"WhatsApp"**, click it
- If you don't see it:
  1. Look for **"Add Product"** in left sidebar
  2. Find **"WhatsApp"** in the product list
  3. Click **"Set Up"**

### Step 4: Configure WhatsApp

After clicking WhatsApp in the sidebar:
1. You'll see **"API Setup"** page
2. Look for section titled **"Step 1: Select a business phone number"**
3. Click **"Add phone number"** button
4. This opens the phone number wizard

### Step 5: Phone Number Wizard
1. You may be asked to select or create a **WhatsApp Business Account**
   - If creating new, name it (e.g., "Fortuna WhatsApp")
   - Click "Create"
2. Then you'll see **"Add a phone number"**
3. Enter: `+852 9579 8058`
4. Verify via SMS
5. Done!

## Method 3: Through Business Settings

### Step 1: Go to Business Settings
URL: **https://business.facebook.com/settings/**

### Step 2: Navigate to WhatsApp Accounts
1. In left sidebar, look for **"Accounts"** section
2. Click **"WhatsApp Accounts"**
3. You'll see your WhatsApp Business Accounts (if any)

### Step 3: Select or Create WhatsApp Business Account
- If you have one, click on it
- If not, click **"Add"** to create one

### Step 4: Add Phone Number
1. Inside the WhatsApp Business Account
2. Look for **"Phone Numbers"** tab
3. Click **"Add"** or **"Add phone number"**
4. Follow the wizard

## What If None of These Work?

If you still can't find the option, it might be because:

### Issue 1: You Don't Have a Meta App
**Solution**: Create one first
- Go to https://developers.facebook.com/apps/
- Click "Create App"
- Type: Business
- Connect to your verified business

### Issue 2: WhatsApp Product Not Available
**Possible causes**:
- Your app is in Development Mode
- Your Business Manager needs additional verification
- Your account doesn't have the right permissions

**Solution**:
1. Check app mode: Should be in "Development" mode (this is OK)
2. Check you're an Admin of the Business Manager
3. Try creating a new app

### Issue 3: You're Not Using the Right Account
**Solution**:
- Make sure you're logged in with the account that has Admin access to your verified Business Manager
- Check at https://business.facebook.com/settings/people

## Alternative: Use Cloud API Directly

If you absolutely can't find the UI, you can use the Cloud API registration endpoint, but you need:

1. **App ID** (from your Meta app)
2. **App Secret** (from your Meta app)
3. **Business Manager ID** (from Business Settings)

Then use this API call:

```bash
curl -X POST "https://graph.facebook.com/v21.0/YOUR_BUSINESS_ID/phone_numbers" \
  -H "Authorization: Bearer YOUR_APP_ACCESS_TOKEN" \
  -d "cc=852" \
  -d "phone_number=95798058" \
  -d "migrate_phone_number=false"
```

But the UI method is much easier!

## Quick Troubleshooting Checklist

Before trying to add a phone number, verify:

- [ ] You're logged into the correct Facebook account
- [ ] You have Admin role in your Business Manager
- [ ] Your Business Manager is verified
- [ ] You have created a Meta app (https://developers.facebook.com/apps/)
- [ ] Your app is connected to your verified Business Manager
- [ ] You've added WhatsApp product to your app
- [ ] Your phone number is not already registered elsewhere

## What You Should See After Success

After successfully adding the phone number:

1. **In WhatsApp Manager** (https://business.facebook.com/wa/manage/phone-numbers/):
   - Your phone number listed: `+852 9579 8058`
   - Status: Active/Connected
   - Display name shown

2. **In Meta App Dashboard** (https://developers.facebook.com/apps/):
   - WhatsApp > API Setup
   - Phone Number ID displayed (e.g., `123456789012345`)
   - Option to generate test messages

3. **You can now**:
   - Generate access tokens
   - Send test messages
   - View phone number details
   - Add it to your application

## Still Need Help?

Tell me:
1. What URL are you currently at?
2. What do you see on the screen? (describe the buttons/options)
3. Do you have a Meta app created?
4. When you visit https://business.facebook.com/wa/manage/home/, what's displayed?

I can give you specific instructions based on what you're seeing!
