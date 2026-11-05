import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cliente público usado por catálogo y apertura. No conservar lecturas entre
// peticiones aunque cambie la configuración de caché de una página.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
})
