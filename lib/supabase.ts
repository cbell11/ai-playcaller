import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a client for debugging
const debugClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'private'
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': 'return=representation'
    }
  }
})

// Main client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': 'return=representation'
    }
  }
})

// Function to check table access
export async function checkTableAccess() {
  console.log('Checking table access...')
  
  // Try public schema
  const publicResult = await supabase
    .from('scouting_reports')
    .select('count')
    .limit(1)
  
  console.log('Public schema access:', {
    error: publicResult.error,
    data: publicResult.data
  })
  
  // Try private schema
  const privateResult = await debugClient
    .from('scouting_reports')
    .select('count')
    .limit(1)
  
  console.log('Private schema access:', {
    error: privateResult.error,
    data: privateResult.data
  })
  
  // Try direct SQL query to check table existence and structure
  const { data: tableInfo, error: tableError } = await supabase
    .rpc('check_table_info', {
      table_name: 'scouting_reports'
    })
  
  console.log('Table info:', {
    data: tableInfo,
    error: tableError
  })

  // Try direct SQL query to get all tables
  const { data: allTables, error: tablesError } = await supabase
    .rpc('list_tables')
  
  console.log('All tables:', {
    data: allTables,
    error: tablesError
  })

  // Try a raw count query
  const { data: rawCount, error: countError } = await supabase
    .rpc('count_scouting_reports')
  
  console.log('Raw count:', {
    data: rawCount,
    error: countError
  })
}
