/**
 * supabase.ts — compatibility shim
 *
 * @supabase/supabase-js has been removed. The backend is now a custom
 * Express + PostgreSQL server. All data access goes through lib/api.ts
 * (REST) and lib/ws.ts (WebSockets via Socket.io).
 *
 * This file is kept as a stub to prevent import errors while any
 * remaining references are migrated. Do not add new imports from here.
 */

export const supabase = null;
