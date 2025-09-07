'use server'

import { createClient } from '@supabase/supabase-js'

export interface HelpVideo {
  id: string
  title: string
  loom_url: string
  video_type: 'showcase' | 'tutorial' | 'tips'
  position: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface HelpVideosResult {
  success: boolean
  data?: HelpVideo[]
  error?: {
    message: string
    details?: string
    code?: string
  }
}

interface HelpVideoResult {
  success: boolean
  data?: HelpVideo
  error?: {
    message: string
    details?: string
    code?: string
  }
}

export async function getHelpVideos(): Promise<HelpVideosResult> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
      .from('help_videos')
      .select('*')
      .eq('is_active', true)
      .order('position', { ascending: true })

    if (error) {
      console.error('Error fetching help videos:', error)
      return { success: false, error: { message: error.message, details: error.details, code: error.code } }
    }

    return { success: true, data: data as HelpVideo[] }
  } catch (error) {
    console.error('Unexpected error when fetching help videos:', error)
    return { success: false, error: { message: error instanceof Error ? error.message : 'An unexpected error occurred' } }
  }
}

export async function getAllHelpVideos(): Promise<HelpVideosResult> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
      .from('help_videos')
      .select('*')
      .order('position', { ascending: true })

    if (error) {
      console.error('Error fetching all help videos:', error)
      return { success: false, error: { message: error.message, details: error.details, code: error.code } }
    }

    return { success: true, data: data as HelpVideo[] }
  } catch (error) {
    console.error('Unexpected error when fetching all help videos:', error)
    return { success: false, error: { message: error instanceof Error ? error.message : 'An unexpected error occurred' } }
  }
}

export async function updateHelpVideo(
  id: string,
  title: string,
  loom_url: string,
  position?: number
): Promise<HelpVideoResult> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Validate Loom URL format
    if (loom_url && !isValidLoomUrl(loom_url)) {
      return { 
        success: false, 
        error: { 
          message: 'Invalid Loom URL format. Please use a valid Loom embed URL.' 
        } 
      }
    }

    const updateData: any = {
      title: title.trim(),
      loom_url: loom_url.trim(),
      updated_at: new Date().toISOString()
    }

    if (position !== undefined) {
      updateData.position = position
    }

    const { data, error } = await supabase
      .from('help_videos')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating help video:', error)
      return { success: false, error: { message: error.message, details: error.details, code: error.code } }
    }

    return { success: true, data: data as HelpVideo }
  } catch (error) {
    console.error('Unexpected error when updating help video:', error)
    return { success: false, error: { message: error instanceof Error ? error.message : 'An unexpected error occurred' } }
  }
}

export async function createHelpVideo(
  title: string,
  loom_url: string,
  video_type: 'showcase' | 'tutorial' | 'tips',
  position: number
): Promise<HelpVideoResult> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Validate Loom URL format
    if (!isValidLoomUrl(loom_url)) {
      return { 
        success: false, 
        error: { 
          message: 'Invalid Loom URL format. Please use a valid Loom embed URL.' 
        } 
      }
    }

    const { data, error } = await supabase
      .from('help_videos')
      .insert({
        title: title.trim(),
        loom_url: loom_url.trim(),
        video_type,
        position,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating help video:', error)
      return { success: false, error: { message: error.message, details: error.details, code: error.code } }
    }

    return { success: true, data: data as HelpVideo }
  } catch (error) {
    console.error('Unexpected error when creating help video:', error)
    return { success: false, error: { message: error instanceof Error ? error.message : 'An unexpected error occurred' } }
  }
}

export async function deleteHelpVideo(id: string): Promise<{ success: boolean; error?: any }> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase
      .from('help_videos')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting help video:', error)
      return { success: false, error: { message: error.message, details: error.details, code: error.code } }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected error when deleting help video:', error)
    return { success: false, error: { message: error instanceof Error ? error.message : 'An unexpected error occurred' } }
  }
}

// Helper function to validate Loom URLs
function isValidLoomUrl(url: string): boolean {
  if (!url) return false
  
  // Allow both loom.com/share and loom.com/embed URLs
  const loomPattern = /^https:\/\/(www\.)?loom\.com\/(share|embed)\/[a-zA-Z0-9]+(\?.*)?$/
  return loomPattern.test(url)
} 