# How to Check Meta Business Verification Status

## Error You're Seeing

```
"Invalid account linking. It could be due to non-approved or pending Whatsapp business account"
```

This means your WhatsApp Business Account needs Meta Business Verification.

## Quick Status Check

### Method 1: Via Meta Business Manager UI

1. Go to: https://business.facebook.com/settings
2. Click "Business Info" in the left sidebar
3. Look for "Verification Status"

**Possible statuses**:
- ✅ **Verified** - You're good to go, the issue is something else
- ⏳ **Pending** - Wait for Meta to complete review (1-3 business days)
- ⚠️ **Verification Required** - You need to submit documents
- ❌ **Not Verified** - Start the verification process

### Method 2: Via WhatsApp Manager

1. Go to: https://business.facebook.com/wa/manage/home
2. Check if you see a banner or alert about verification
3. Look for your phone number status

### Method 3: Via API (Technical)

You can check via API to see the exact status:

```bash
# Check WhatsApp Business Account Status
curl -X GET "https://graph.facebook.com/v21.0/me/accounts?access_token=YOUR_ACCESS_TOKEN"
```

Look for the `account_review_status` field in the response.

## What To Do Based On Status

### If Status = "Not Verified" or "Verification Required"

**Start Business Verification**:

1. Go to: https://business.facebook.com/settings/security
2. Click "Start Verification"
3. Prepare these documents:

**Required Documents** (choose based on your business type):
- Business registration certificate
- Articles of incorporation
- Tax registration document (BR Certificate for HK businesses)
- Proof of business address (utility bill, bank statement)
- Government-issued ID of business owner

**For Hong Kong Businesses**:
- Business Registration (BR) certificate
- Certificate of Incorporation (CI) if limited company
- HKID of business owner/director
- Proof of address (recent utility bill or bank statement)

4. Upload documents
5. Submit for review
6. **Wait 1-3 business days** (can take up to 2 weeks in some cases)

### If Status = "Pending"

**Your verification is being reviewed**:
- Check your email (including spam folder) for updates from Meta
- Wait for approval
- Meta may request additional documents - respond promptly
- Average review time: 1-3 business days

**While waiting**, you can:
- Prepare your WhatsApp message templates
- Set up your integration code
- Test with a test phone number if available

### If Status = "Verified" (But Still Getting Error)

If your business is already verified but you're still getting this error, the issue might be:

1. **App Not Linked to Verified Business**:
   - Go to Meta App Dashboard
   - Settings > Basic
   - Ensure "Business Manager" field shows your verified business

2. **WhatsApp Product Not Approved**:
   - Go to your app in Meta Developer Dashboard
   - Check if "WhatsApp" product shows as approved
   - May need separate app review

3. **Phone Number Not Associated**:
   - The phone number might not be properly linked to your verified business account
   - Go to WhatsApp Manager
   - Check phone number ownership

4. **Access Token Issues**:
   - Your access token might be from a user/app that doesn't have access to the verified business
   - Generate a new token from a System User within your verified business

## Faster Alternative: Embedded Signup (Test Mode)

If you need to test immediately while waiting for full verification:

1. Go to: https://developers.facebook.com/apps/
2. Select your app
3. Add "WhatsApp" product (if not added)
4. Click "Get Started" on WhatsApp
5. Use "Embedded Signup" option
6. Follow the wizard - this creates a test account that's auto-approved

This gives you:
- Test WhatsApp Business Account (auto-verified)
- Test phone number you can use immediately
- Limited to 5 test numbers
- Good for development and testing

## Timeline Expectations

| Step | Time Required |
|------|---------------|
| Document preparation | 1-2 hours |
| Upload & submit | 30 minutes |
| Meta initial review | 1-3 business days |
| Additional info request (if needed) | +2-5 business days |
| Final approval | Immediate after review |
| **Total typical time** | **2-7 business days** |

## Common Verification Rejection Reasons

If your verification gets rejected:

1. **Mismatched information**: Business name on documents doesn't match Meta account
2. **Poor quality documents**: Blurry, partial, or expired documents
3. **Unverifiable address**: PO Box addresses or virtual offices may be rejected
4. **Incomplete information**: Missing required fields or documents
5. **Business type restrictions**: Some business types (crypto, adult content, etc.) have additional requirements

## What To Do After Approval

Once you receive approval email:

1. ✅ Your account status will change to "Verified"
2. ✅ Wait 1-2 hours for the change to propagate through Meta's systems
3. ✅ Try phone registration again in your application
4. ✅ It should work!

## Still Need Help?

If you've been verified but still getting errors:

1. Share your Meta Business Manager ID
2. Share your App ID
3. Confirm verification status
4. Check if the phone number is in the correct business account

## Current Recommended Action

Based on your error, you should:

1. **Immediately**: Check your verification status at https://business.facebook.com/settings
2. **If not verified**: Start the verification process with required documents
3. **If pending**: Wait for Meta's review (check email daily)
4. **If verified**: Check that your app and phone number are properly linked to the verified business

The phone number registration will work once your WhatsApp Business Account is verified and approved by Meta.
