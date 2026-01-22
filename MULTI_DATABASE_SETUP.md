# Multi-Database Setup Guide

This application supports connecting to two Supabase databases simultaneously:
1. **Main Database** - Your primary database (already configured)
2. **Client Database** - A second database for client-specific data

## Setup Instructions

### 1. Add Second Database Credentials

Add the following credentials to your `.env` file:

```env
# Second Supabase Database (Client Database)
VITE_SUPABASE_CLIENT_URL=https://your-client-project.supabase.co
VITE_SUPABASE_CLIENT_ANON_KEY=your-client-anon-key
```

To get these credentials:
1. Go to your second Supabase project dashboard
2. Navigate to Settings > API
3. Copy the "Project URL" and "anon/public" key

### 2. Using Multiple Databases in Your Code

#### Main Database (Default)
```typescript
import { supabase } from '@/lib/supabase';

// Query the main database
const { data, error } = await supabase
  .from('projects')
  .select('*');
```

#### Client Database (Second Database)
```typescript
import { supabaseClient } from '@/lib/supabaseClient';

// Check if client database is configured
if (supabaseClient) {
  // Query the client database
  const { data, error } = await supabaseClient
    .from('client_data')
    .select('*');
}
```

### 3. Example: Using Both Databases Together

```typescript
import { supabase } from '@/lib/supabase';
import { supabaseClient } from '@/lib/supabaseClient';

async function syncDataBetweenDatabases() {
  // Get data from main database
  const { data: mainData } = await supabase
    .from('clients')
    .select('*');

  // Send data to client database (if configured)
  if (supabaseClient && mainData) {
    const { error } = await supabaseClient
      .from('synced_clients')
      .upsert(mainData);

    if (error) {
      console.error('Sync failed:', error);
    }
  }
}
```

## Common Use Cases

### 1. Client-Specific Data Isolation
Store sensitive client data in a separate database with different access controls.

### 2. Multi-Tenant Architecture
Each client gets their own database instance, connected via the client database connection.

### 3. Data Synchronization
Sync specific data between your main operational database and a client-facing database.

### 4. Reporting Database
Use the second database as a read-only replica for reporting and analytics.

## Authentication

Both databases can have independent authentication systems:

```typescript
// Main database auth
import { supabase } from '@/lib/supabase';
await supabase.auth.signIn({ email, password });

// Client database auth (if needed)
import { supabaseClient } from '@/lib/supabaseClient';
if (supabaseClient) {
  await supabaseClient.auth.signIn({ email, password });
}
```

## Environment Variables

Make sure to add the client database credentials to your deployment environment:

**Vercel:**
1. Go to Project Settings > Environment Variables
2. Add `VITE_SUPABASE_CLIENT_URL` and `VITE_SUPABASE_CLIENT_ANON_KEY`
3. Redeploy your application

## Security Considerations

1. **Row Level Security (RLS)**: Enable RLS on both databases
2. **API Keys**: Keep anon keys in environment variables, never commit them
3. **Access Control**: Use different RLS policies for each database based on requirements
4. **Service Role Keys**: If needed for server-side operations, add them securely

## Troubleshooting

**Client database not working?**
- Check that environment variables are set correctly
- Verify the URL and anon key are from the correct Supabase project
- Ensure the second database has the required tables and RLS policies
- Check browser console for connection errors

**CORS issues?**
- Add your application domain to the allowed origins in both Supabase projects
- Go to Authentication > URL Configuration in each project's dashboard
