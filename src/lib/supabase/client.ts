// Supabase client for Client Components (runs in the browser).

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
