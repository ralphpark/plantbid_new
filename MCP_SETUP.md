# MCP Server Integration

This document outlines the integration of Model-Context-Protocol (MCP) servers for Supabase and Vercel into the PlantBid application.

## Overview

MCP allows AI assistants to interact with external tools and services. We have set up MCP servers to provide programmatic access to Supabase and Vercel, enabling AI-driven development and management tasks.

## New MCP Endpoints

The following API endpoints have been added to the application:

-   `/mcp/supabase/postgrest`: Provides access to the Supabase database via PostgREST, allowing for natural language queries.
-   `/mcp/supabase/admin`: Provides access to Supabase admin-level functions, such as user and storage management.
-   `/mcp/vercel`: Provides access to Vercel API for tasks like monitoring deployments.

## Required Environment Variables

To use the new MCP servers, you need to add the following environment variables to your `.env` file:

-   `SUPABASE_URL`: The URL of your Supabase project.
-   `SUPABASE_SERVICE_KEY`: The service role key for your Supabase project. This key has admin privileges and should be kept secret.
-   `SUPABASE_ANON_KEY`: The anonymous key for your Supabase project. This key is safe to use in a browser or other client-side code.
-   `SUPABASE_SCHEMA`: (Optional) The database schema to use. Defaults to `public`.
-   `VERCEL_TOKEN`: A Vercel API token with access to your projects.

You can create a Vercel API token in your Vercel account settings.

## How to Use

With the MCP servers running, you can configure an AI assistant that supports MCP (like some versions of Cursor or other IDE plugins) to connect to these endpoints. This will allow you to use natural language to interact with your Supabase database and Vercel projects.
