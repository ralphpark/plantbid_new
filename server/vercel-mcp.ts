// server/vercel-mcp.ts

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

if (!VERCEL_TOKEN) {
  console.warn(
    'Vercel environment variable (VERCEL_TOKEN) is not set. Vercel MCP server will not be available.'
  );
}

// 1. Create an MCP Server instance
export const vercelMcpServer = new McpServer({
  name: 'PlantBidVercelMCP',
  version: '1.0.0',
  description: 'MCP server for Vercel tools',
});

// 2. Define and register a tool
// This tool simulates getting the latest Vercel deployment status
vercelMcpServer.tool(
  'getLatestDeployment',
  {
    projectId: z.string().describe('The Vercel project ID'),
  },
  async ({ projectId }) => {
    if (!VERCEL_TOKEN) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'VERCEL_TOKEN is not configured.' }),
          },
        ],
      };
    }
    
    // In a real application, you would fetch deployment status from the Vercel API
    // For this example, we return mock data
    const mockDeployment = {
      id: `dpl_${crypto.randomUUID()}`,
      url: `${projectId}.vercel.app`,
      state: 'READY',
      createdAt: Date.now(),
    };
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(mockDeployment),
        },
      ],
    };
  }
);

// 3. Create a transport for the MCP server
export const vercelMcpTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

console.log('Vercel MCP server created (not yet connected).');
