// Supabase connection settings. Both values are public by design; the database is
// protected by Row Level Security (supabase/migrations/0001_init.sql).
// Written out in full so Next.js can inline them into browser code.

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const isSupabaseConfigured = supabaseUrl !== "" && supabasePublishableKey !== "";
