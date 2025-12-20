// server/supabase-mcp.ts

import { createPostgrestMcpServer } from '@supabase/mcp-server-postgrest';
import { createSupabaseMcpServer as createSupabaseAdminMcpServer } from '@supabase/mcp-server-supabase';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// These values should be stored in your .env file
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'public';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase environment variables (SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY) are not set. Supabase MCP server will not be available.'
  );
}

// MCP Server for PostgREST (for data queries)
export const postgrestMcpServer = SUPABASE_URL && SUPABASE_ANON_KEY ? createPostgrestMcpServer({
  apiUrl: `${SUPABASE_URL}/rest/v1`,
  apiKey: SUPABASE_ANON_KEY,
  schema: SUPABASE_SCHEMA,
}) : null;

// MCP Server for Supabase Admin (for managing users, storage, etc.)
export const supabaseAdminMcpServer = SUPABASE_URL && SUPABASE_SERVICE_KEY ? createSupabaseAdminMcpServer({
  apiUrl: SUPABASE_URL,
  apiKey: SUPABASE_SERVICE_KEY,
}) : null;

// Transports for the MCP servers
export const postgrestMcpTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

export const supabaseAdminMcpTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

console.log('Supabase MCP servers and transports created (not yet connected).');
