// Writes supabase/seed/starter-library.sql from supabase/seed/starter-library.ts.
// Run with: npm run seed:build   (Node 22.18+ runs the TypeScript file directly.)

import fs from "node:fs";
import { buildStarterSeedSql } from "../supabase/seed/starter-library.ts";

const out = new URL("../supabase/seed/starter-library.sql", import.meta.url);
fs.writeFileSync(out, buildStarterSeedSql());
console.log(`Wrote ${out.pathname}`);
