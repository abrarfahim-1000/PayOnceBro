import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY is missing from .env. Backend will use ANON_KEY, which may cause RLS errors during profile syncing.')
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  // Service role key for admin ops; fall back to anon key for local dev
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
)

export default supabase
