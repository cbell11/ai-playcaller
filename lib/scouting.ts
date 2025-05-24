import { PostgrestError } from '@supabase/supabase-js'
import { getScoutingReport as getScoutingReportAction } from '@/app/actions/scouting-reports'

interface ScoutingOption {
  id?: string
  name: string
  fieldArea?: string
  dominateDown?: string
  percentage?: number
  notes?: string
}

interface ScoutingReport {
  fronts: ScoutingOption[]
  coverages: ScoutingOption[]
  blitzes: ScoutingOption[]
  fronts_pct: Record<string, number>
  coverages_pct: Record<string, number>
  blitz_pct: Record<string, number>
  overall_blitz_pct: number
  notes: string
}

interface ScoutingReportResult {
  success: boolean
  data?: ScoutingReport
  error?: string
}

export async function getScoutingReport(teamId: string, opponentId: string): Promise<ScoutingReportResult> {
  try {
    // Call the server action to get the report
    const result = await getScoutingReportAction(teamId.trim(), opponentId.trim())

    if (!result.success) {
      return {
        success: false,
        error: result.error?.message || 'Failed to fetch scouting report'
      }
    }

    if (!result.data) {
      return {
        success: true,
        data: {
          fronts: [],
          coverages: [],
          blitzes: [],
          fronts_pct: {},
          coverages_pct: {},
          blitz_pct: {},
          overall_blitz_pct: 0,
          notes: ''
        }
      }
    }

    const report = result.data

    // Parse the data carefully
    let fronts: ScoutingOption[] = []
    let coverages: ScoutingOption[] = []
    let blitzes: ScoutingOption[] = []
    let fronts_pct: Record<string, number> = {}
    let coverages_pct: Record<string, number> = {}
    let blitz_pct: Record<string, number> = {}

    try {
      // Parse arrays if they're strings
      if (typeof report.fronts === 'string') {
        fronts = JSON.parse(report.fronts)
      } else if (Array.isArray(report.fronts)) {
        fronts = report.fronts
      }

      if (typeof report.coverages === 'string') {
        coverages = JSON.parse(report.coverages)
      } else if (Array.isArray(report.coverages)) {
        coverages = report.coverages
      }

      if (typeof report.blitzes === 'string') {
        blitzes = JSON.parse(report.blitzes)
      } else if (Array.isArray(report.blitzes)) {
        blitzes = report.blitzes
      }

      // Parse percentage objects if they're strings
      if (typeof report.fronts_pct === 'string') {
        fronts_pct = JSON.parse(report.fronts_pct)
      } else if (typeof report.fronts_pct === 'object' && report.fronts_pct !== null) {
        fronts_pct = report.fronts_pct
      }

      if (typeof report.coverages_pct === 'string') {
        coverages_pct = JSON.parse(report.coverages_pct)
      } else if (typeof report.coverages_pct === 'object' && report.coverages_pct !== null) {
        coverages_pct = report.coverages_pct
      }

      if (typeof report.blitz_pct === 'string') {
        blitz_pct = JSON.parse(report.blitz_pct)
      } else if (typeof report.blitz_pct === 'object' && report.blitz_pct !== null) {
        blitz_pct = report.blitz_pct
      }
    } catch (error) {
      console.error('Error parsing scouting report data:', error)
    }

    const overall_blitz_pct = typeof report.overall_blitz_pct === 'number' ? 
      report.overall_blitz_pct : 
      Number(report.overall_blitz_pct) || 0

    const notes = typeof report.notes === 'string' ? report.notes : ''

    return {
      success: true,
      data: {
        fronts,
        coverages,
        blitzes,
        fronts_pct,
        coverages_pct,
        blitz_pct,
        overall_blitz_pct,
        notes
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }
  }
} 