'use server'

import { createClient } from '@supabase/supabase-js'

export async function deleteUserFromAuth(userId: string) {
  // Create a Supabase client with service role key for admin operations
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // This is the service role key, not the anon key
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  try {
    // Delete user from Supabase Auth using admin client
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (error) {
      console.error('Error deleting user from auth:', error)
      throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to delete user from auth:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
} 