# Google Shared Drive Setup for File Uploads

## Problem

When trying to upload files to Google Drive, you may encounter this error:

```
Service Accounts do not have storage quota. Leverage shared drives
(https://developers.google.com/workspace/drive/api/guides/about-shareddrives),
or use OAuth delegation instead.
```

This happens because **Google Service Accounts cannot upload files to personal Google Drive folders**. They can only upload to **Shared Drives (Team Drives)**.

## Solution: Move Folders to Shared Drive

Follow these steps to fix the upload issue:

### Step 1: Create a Shared Drive (if you don't have one)

1. Go to [Google Drive](https://drive.google.com)
2. Click **Shared drives** in the left sidebar
3. Click **+ New** at the top
4. Enter a name for your Shared Drive (e.g., "Fortuna ERP Files")
5. Click **Create**

### Step 2: Move Your Project Folders to the Shared Drive

1. In Google Drive, navigate to the folder you want to move
   - Current parent folder ID: `0AKtw1OOFlpHcUk9PVA`
2. Right-click the folder and select **Move to** or **Organize** > **Move**
3. Select the Shared Drive you created
4. Click **Move** to confirm

**Important:** All project folders must be on the Shared Drive for uploads to work.

### Step 3: Add Service Account to Shared Drive

1. Open the Shared Drive you created
2. Click the Shared Drive name at the top
3. Click **Manage members** (the person icon with a +)
4. Add the service account email:
   ```
   fortunaerp@fortuna-erp.iam.gserviceaccount.com
   ```
5. Set the role to **Content Manager** or **Manager**
6. Uncheck "Notify people" (service accounts don't need notifications)
7. Click **Send** or **Done**

### Step 4: Update Parent Folder ID (if needed)

If you moved folders to a new location, update the parent folder ID in the code:

1. Open the file: `supabase/functions/create-marketing-folders/index.ts`
2. Find the line: `const PARENT_FOLDER_ID = '0AKtw1OOFlpHcUk9PVA';`
3. Replace with the new folder ID from the Shared Drive
4. Deploy the updated edge function

### Step 5: Verify Permissions

Test that uploads work:

1. Navigate to Marketing > [Project] > Files
2. Try dragging and dropping a small file
3. File should upload successfully

## Troubleshooting

### Still Getting Storage Quota Error?

- **Check** that the folder is actually on a Shared Drive (not "My Drive")
- **Verify** the service account email is added as a member of the Shared Drive
- **Confirm** the service account has "Content Manager" or "Manager" role

### Cannot Move Folders?

- You need **Editor** or **Manager** permissions on the folders
- Some organizational Google Workspace accounts may restrict Shared Drive creation
- Contact your Google Workspace administrator for help

### Files Upload But Can't Be Seen?

- Check RLS policies in Supabase for `marketing_share_resources` table
- Verify the `google_drive_folder_id` is correctly stored in the database

## Alternative: OAuth Delegation

If you cannot use Shared Drives, you can implement OAuth delegation:

1. Use user OAuth tokens instead of service account
2. Users authenticate with their Google account
3. Files are uploaded to their personal Drive with their permissions

**Note:** This requires significant code changes and is more complex to implement.

## References

- [Google Shared Drives Documentation](https://developers.google.com/workspace/drive/api/guides/about-shareddrives)
- [Service Account Limitations](https://developers.google.com/workspace/drive/api/guides/service-accounts)
- [OAuth 2.0 for Drive API](https://developers.google.com/drive/api/guides/about-auth)
