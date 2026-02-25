# WhatsApp Messaging System Guide

## Overview

The WhatsApp Messaging System allows you to manage WhatsApp Business API communications directly within your Project Manager application. You can register WhatsApp business numbers, receive incoming messages, send outbound messages, assign conversations to team members, and add internal notes.

## Features

1. **WhatsApp Number Registration** - Register your WhatsApp Business phone numbers via Meta API
2. **Message Management** - View all inbound and outbound WhatsApp messages
3. **Message Assignment** - Assign messages to team members
4. **Transfer History** - Track message assignment transfers
5. **Internal Notes** - Add internal notes to messages for team collaboration
6. **Contact Management** - Store and manage WhatsApp contacts
7. **Client Linking** - Link WhatsApp contacts to existing clients
8. **Message Filtering** - Filter messages by status, direction, and assignment
9. **Priority Levels** - Set priority levels (low, normal, high, urgent) for messages
10. **Real-time Updates** - Receive instant notifications when new messages arrive

## Getting Started

### Step 1: Access the Messages Section

1. Log in to your Project Manager
2. Click on the **"Messages"** button in the main navigation bar (next to Com Sec and Admin)
3. You'll see the WhatsApp Messages page

### Step 2: Register a WhatsApp Business Number

Before you can send or receive messages, you need to register your WhatsApp Business phone number:

1. Click the **"Register Number"** button in the top-right corner
2. Fill in the required information:
   - **Phone Number ID**: From Meta Business Manager (e.g., `123456789012345`)
   - **6-Digit PIN**: Your chosen 6-digit PIN for registration
   - **Access Token**: Permanent access token from Meta (this is stored securely)
   - **Display Name**: A friendly name for this number (e.g., "Customer Support")
   - **Phone Number**: The actual phone number (e.g., `+852 1234 5678`)
   - **Meta Business Account ID** (optional)

3. Click **"Register Number"**

The system will:
- Call the Meta WhatsApp API to register your number
- Retrieve verification status and quality rating
- Store the number in the database for future use

### Step 3: Set Up Webhook (Important!)

After registering your number, you need to configure the webhook in Meta Business Manager:

1. Go to your Meta Business Manager
2. Navigate to WhatsApp > Configuration
3. Set the Webhook URL to:
   ```
   https://your-project-url.supabase.co/functions/v1/whatsapp-webhook
   ```
4. Set the Verify Token to: `my_verify_token_12345` (or the token you configured)
5. Subscribe to these webhook fields:
   - messages
   - message_status

Now incoming messages will automatically appear in your Messages dashboard!

## Using the Messages Dashboard

### Viewing Messages

- All messages are displayed in a list format
- Each message shows:
  - Direction (Inbound/Outbound)
  - Contact phone number
  - Message content or media type
  - Status (sent, delivered, read, failed)
  - Priority level
  - Assigned team member (if any)
  - Timestamp

### Filtering Messages

Use the filter options at the top of the page:

- **Search**: Search by message content or phone number
- **Direction**: Filter by inbound or outbound messages
- **Status**: Show all, pending reply, or replied messages
- **Assignment**: Filter by assigned team member or show unassigned

### Assigning Messages

To assign a message to a team member:

1. Click the **user-plus icon** on the message card
2. Select the team member from the dropdown
3. Optionally add a transfer note explaining why you're assigning it
4. Click **"Assign"**

The assignment history is tracked for accountability.

### Adding Notes

To add an internal note to a message:

1. Click the **note icon** on the message card
2. Enter your note (visible only to your team)
3. Click **"Add Note"**

Notes appear below the message when you click on it.

## How Messages Flow

### Incoming Messages (Inbound)

1. Customer sends a WhatsApp message to your business number
2. Meta sends webhook notification to your system
3. Message is automatically saved to the database
4. Contact is created or updated
5. Message appears in your Messages dashboard instantly
6. Team members can see and respond to the message

### Outgoing Messages (Outbound)

Outbound message sending can be integrated using the WhatsApp Business API. The system stores:
- Message ID from Meta
- Status updates (sent, delivered, read, failed)
- Message content and type

## Database Structure

The system uses these tables:

- **whatsapp_phone_numbers**: Your registered business numbers
- **whatsapp_contacts**: Contact information for message senders
- **whatsapp_messages**: All messages (inbound and outbound)
- **whatsapp_message_notes**: Internal notes on messages
- **whatsapp_message_assignments**: Assignment history

## Troubleshooting

### Messages Not Appearing

1. Check that your webhook is configured correctly in Meta Business Manager
2. Verify the webhook URL is accessible
3. Check that your phone number is registered and active
4. Look at the Edge Function logs for errors

### Registration Failed

1. Verify your Phone Number ID is correct
2. Check that your Access Token is valid and has proper permissions
3. Ensure the 6-digit PIN is exactly 6 digits
4. Check Meta Business Manager for any account issues

### Can't Assign Messages

1. Verify the team member exists in the `staff` table
2. Check that you have proper permissions
3. Refresh the page and try again

## API Endpoints

### Register WhatsApp Number

```bash
POST https://your-project-url.supabase.co/functions/v1/register-whatsapp-number
Content-Type: application/json
Authorization: Bearer YOUR_SUPABASE_ANON_KEY

{
  "phone_number_id": "123456789012345",
  "pin": "123456",
  "access_token": "YOUR_META_ACCESS_TOKEN",
  "display_name": "Customer Support",
  "phone_number": "+852 1234 5678",
  "meta_business_account_id": "optional"
}
```

### Webhook Endpoint

The webhook endpoint handles incoming messages and status updates:

```
GET/POST https://your-project-url.supabase.co/functions/v1/whatsapp-webhook
```

## Security Notes

1. Access tokens are stored in the database and should be encrypted at rest
2. Only authenticated users can view and manage messages
3. Webhook verification token prevents unauthorized webhook calls
4. Row Level Security (RLS) ensures proper data access control

## Next Steps

1. Register your WhatsApp Business number
2. Configure your webhook in Meta Business Manager
3. Start receiving and managing messages
4. Train your team on message assignment and notes
5. Link WhatsApp contacts to existing clients for better tracking

For technical support or questions, contact your system administrator.
