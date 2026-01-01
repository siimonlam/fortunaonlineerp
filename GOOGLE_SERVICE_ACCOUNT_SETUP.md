# Google Service Account Setup for Drive Access

This guide explains how to set up a Google Service Account for accessing Google Drive files in the application.

## Overview

The application uses a service account (`fortunaerp@fortuna-erp.iam.gserviceaccount.com`) to browse and download files from Google Drive. This provides secure, server-side access without requiring individual users to authenticate.

## Setup Instructions

### 1. Create or Access Service Account

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **IAM & Admin** > **Service Accounts**
4. Find the service account: `fortunaerp@fortuna-erp.iam.gserviceaccount.com`
   - If it doesn't exist, create it with this email

### 2. Generate Private Key

1. Click on the service account
2. Go to the **Keys** tab
3. Click **Add Key** > **Create new key**
4. Select **JSON** format
5. Click **Create** - this will download a JSON file

### 3. Enable Google Drive API

1. In Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Google Drive API"
3. Click **Enable** if not already enabled

### 4. Grant Drive Access to Service Account

The service account needs access to the specific Google Drive folders:

1. Open Google Drive
2. Navigate to the folder you want to share (e.g., "Shared Files" folder)
3. Right-click the folder and select **Share**
4. Add the service account email: `fortunaerp@fortuna-erp.iam.gserviceaccount.com`
5. Set permission to **Viewer** (read-only) or **Editor** if upload is needed
6. Click **Send**

### 5. Configure Supabase Secret

The private key from the JSON file needs to be stored as a Supabase secret:

1. Open the downloaded JSON key file
2. Copy the entire `private_key` value (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
3. Go to your Supabase project dashboard
4. Navigate to **Edge Functions** > **Manage secrets**
5. Add a new secret:
   - Name: `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
   - Value: Paste the private key (including header and footer)
6. Click **Save**

**Important**: Keep the private key secure and never commit it to version control.

## Testing

After setup, test the integration:

1. Go to the Share Resources page in the application
2. Click **Browse Files** button
3. You should see the files in the shared Google Drive folder
4. Try navigating folders and downloading files

## Troubleshooting

### "Service account private key not configured" error
- Ensure the secret `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` is set in Supabase
- Verify the private key includes the BEGIN and END markers
- Check that there are no extra spaces or line breaks

### "Failed to get access token" error
- Verify the service account email is correct
- Ensure Google Drive API is enabled in Google Cloud Console
- Check that the private key format is valid (should be PKCS8)

### "Failed to list files" error
- Confirm the service account has access to the Drive folder
- Verify the folder ID is correct
- Check that the folder hasn't been deleted or moved

### Files not showing
- Ensure the service account has been granted access to the folder
- Check that files aren't in the trash
- Verify the folder ID matches the shared folder

## Security Notes

- The service account has read-only access to shared folders
- Private keys should never be exposed in client-side code
- All Drive API calls go through the Supabase Edge Function
- Users cannot access files the service account doesn't have permission for

## Folder IDs

Current configured folders:
- Shared Files: `0AK-QGp_5SOJWUk9PVA`

To add more folders, update the folder ID in the component and grant service account access.
