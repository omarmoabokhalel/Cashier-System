import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pwcfkhzfcgewlkitthnc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3Y2ZraHpmY2dld2xraXR0aG5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NzE5ODEsImV4cCI6MjEwNTI0Nzk4MX0.LWfAQ0HY3YJQM2w4wCJklfizDu4avG04Tn-TqyG11WA';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
