"use client"

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, ImageIcon, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface ScoutingTerminology {
  id: string
  name: string
  type: 'front' | 'coverage' | 'blitz'
}

interface DuplicateCard {
  id: string
  image_url: string
}

const DEFAULT_TEAM_ID = '8feef3dc-942f-4bc5-b526-0b39e14cb683'

export default function ScoutCardsPage() {
  const [fronts, setFronts] = useState<ScoutingTerminology[]>([])
  const [coverages, setCoverages] = useState<ScoutingTerminology[]>([])
  const [blitzes, setBlitzes] = useState<ScoutingTerminology[]>([])
  const [selectedFront, setSelectedFront] = useState('')
  const [selectedCoverage, setSelectedCoverage] = useState('')
  const [selectedBlitz, setSelectedBlitz] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [duplicateCard, setDuplicateCard] = useState<DuplicateCard | null>(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setSubmitError('Not authenticated')
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profileError) {
          throw profileError
        }

        if (profile?.role !== 'admin') {
          setSubmitError('Unauthorized: Admin access required')
          return
        }

        fetchScoutingTerminology()
      } catch (err) {
        console.error('Error checking admin status:', err)
        setSubmitError('Failed to check admin status')
      } finally {
        setLoading(false)
      }
    }

    checkAdmin()
  }, [])

  useEffect(() => {
    const checkTerminology = async () => {
      try {
        const { data: terminology, error } = await supabase
          .from('scouting_terminology')
          .select('name, category')
          .order('category')
          .order('name')

        if (error) {
          console.error('Error fetching terminology:', error)
          return
        }

        console.log('All terminology:', terminology.map(t => ({
          name: t.name,
          category: t.category
        })))

        // Group by category for easier viewing
        const grouped = terminology.reduce((acc, curr) => {
          if (!acc[curr.category]) {
            acc[curr.category] = []
          }
          acc[curr.category].push(curr.name)
          return acc
        }, {} as Record<string, string[]>)

        console.log('Grouped terminology:', grouped)
      } catch (err) {
        console.error('Error in checkTerminology:', err)
      }
    }

    checkTerminology()
  }, [])

  const fetchScoutingTerminology = async () => {
    try {
      const { data: frontsData, error: frontsError } = await supabase
        .from('scouting_terminology')
        .select('*')
        .eq('category', 'front')
        .eq('is_enabled', true)
        .order('name')

      const { data: coveragesData, error: coveragesError } = await supabase
        .from('scouting_terminology')
        .select('*')
        .eq('category', 'coverage')
        .eq('is_enabled', true)
        .order('name')

      const { data: blitzesData, error: blitzesError } = await supabase
        .from('scouting_terminology')
        .select('*')
        .eq('category', 'blitz')
        .eq('is_enabled', true)
        .order('name')

      if (frontsError) {
        console.error('Error fetching fronts:', frontsError)
        return
      }
      if (coveragesError) {
        console.error('Error fetching coverages:', coveragesError)
        return
      }
      if (blitzesError) {
        console.error('Error fetching blitzes:', blitzesError)
        return
      }

      setFronts(frontsData || [])
      setCoverages(coveragesData || [])
      setBlitzes(blitzesData || [])
    } catch (err) {
      console.error('Error fetching scouting terminology:', err)
    }
  }

  const checkForDuplicate = async () => {
    try {
      const { data, error } = await supabase
        .from('scout_cards')
        .select('id, image_url')
        .eq('team_id', DEFAULT_TEAM_ID)
        .eq('front', selectedFront)
        .eq('coverage', selectedCoverage === 'None' ? null : selectedCoverage)
        .eq('blitz', selectedBlitz === 'None' ? null : selectedBlitz)
        .single()

      if (error) {
        if (error.code === 'PGRST116') { // No rows found
          return null
        }
        console.error('Supabase error checking for duplicates:', error)
        throw new Error(error.message)
      }

      return data
    } catch (err) {
      if (err instanceof Error) {
        console.error('Error checking for duplicates:', err.message)
      } else {
        console.error('Unknown error checking for duplicates:', err)
      }
      throw err
    }
  }

  const handleSubmitScoutCard = async () => {
    if (!selectedFront || !imageUrl) {
      setSubmitError('Please select a front and provide an image URL')
      return
    }

    try {
      const duplicate = await checkForDuplicate()
      if (duplicate) {
        setDuplicateCard(duplicate)
        setShowDuplicateModal(true)
        return
      }

      await submitCard()
    } catch (err) {
      if (err instanceof Error) {
        console.error('Error in handleSubmitScoutCard:', err.message)
      } else {
        console.error('Unknown error in handleSubmitScoutCard:', err)
      }
      setSubmitError('Failed to check for duplicate scout cards. Please try again.')
    }
  }

  const submitCard = async (existingCardId?: string) => {
    setIsSubmitting(true)
    setSubmitError(null)
    setShowSuccess(false)

    try {
      let error

      if (existingCardId) {
        // Update existing card
        const { error: updateError } = await supabase
          .from('scout_cards')
          .update({
            front: selectedFront,
            coverage: selectedCoverage === 'None' ? null : selectedCoverage,
            blitz: selectedBlitz === 'None' ? null : selectedBlitz,
            image_url: imageUrl
          })
          .eq('id', existingCardId)

        error = updateError
      } else {
        // Insert new card
        const { error: insertError } = await supabase
          .from('scout_cards')
          .insert({
            front: selectedFront,
            coverage: selectedCoverage === 'None' ? null : selectedCoverage,
            blitz: selectedBlitz === 'None' ? null : selectedBlitz,
            image_url: imageUrl,
            team_id: DEFAULT_TEAM_ID
          })

        error = insertError
      }

      if (error) {
        console.error('Supabase error submitting scout card:', error)
        throw new Error(error.message)
      }

      // Reset form
      setSelectedFront('')
      setSelectedCoverage('')
      setSelectedBlitz('')
      setImageUrl('')
      setSubmitError(null)
      setShowDuplicateModal(false)
      setDuplicateCard(null)
      setShowSuccess(true)

      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowSuccess(false)
      }, 3000)

    } catch (err) {
      if (err instanceof Error) {
        console.error('Error submitting scout card:', err.message)
        setSubmitError(`Failed to submit scout card: ${err.message}`)
      } else {
        console.error('Unknown error submitting scout card:', err)
        setSubmitError('Failed to submit scout card. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (submitError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-red-500">{submitError}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-6 w-6" />
          Scout Cards Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {showSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Scout card added successfully
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Front</Label>
              <Select value={selectedFront} onValueChange={setSelectedFront}>
                <SelectTrigger>
                  <SelectValue placeholder="Select front" />
                </SelectTrigger>
                <SelectContent>
                  {fronts.map((front) => (
                    <SelectItem key={front.id} value={front.name}>
                      {front.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Coverage</Label>
              <Select value={selectedCoverage} onValueChange={setSelectedCoverage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select coverage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  {coverages.map((coverage) => (
                    <SelectItem key={coverage.id} value={coverage.name}>
                      {coverage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Blitz</Label>
              <Select value={selectedBlitz} onValueChange={setSelectedBlitz}>
                <SelectTrigger>
                  <SelectValue placeholder="Select blitz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  {blitzes.map((blitz) => (
                    <SelectItem key={blitz.id} value={blitz.name}>
                      {blitz.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Image URL</Label>
            <Input
              type="url"
              placeholder="Enter image URL"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>

          {imageUrl && (
            <div className="space-y-2">
              <Label>Image Preview</Label>
              <div className="border rounded-lg overflow-hidden">
                <img
                  src={imageUrl}
                  alt="Scout card preview"
                  className="w-full h-auto max-h-[400px] object-contain"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>'
                    e.currentTarget.className = 'w-full h-[400px] object-contain p-4 bg-gray-100'
                  }}
                />
              </div>
            </div>
          )}

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {submitError}
            </div>
          )}

          <Button
            onClick={handleSubmitScoutCard}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              'Submit Scout Card'
            )}
          </Button>

          {/* Duplicate Warning Modal */}
          <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Duplicate Scout Card Found
                </DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-gray-500 mb-4">
                  A scout card with the same front, coverage, and blitz already exists.
                </p>
                {duplicateCard?.image_url && (
                  <div className="mb-4">
                    <Label>Existing Card Preview</Label>
                    <div className="border rounded-lg overflow-hidden mt-2">
                      <img
                        src={duplicateCard.image_url}
                        alt="Existing scout card"
                        className="w-full h-auto max-h-[200px] object-contain"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>'
                          e.currentTarget.className = 'w-full h-[200px] object-contain p-4 bg-gray-100'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDuplicateModal(false)}
                >
                  Go Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => duplicateCard && submitCard(duplicateCard.id)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Replacing...
                    </>
                  ) : (
                    'Replace Existing Card'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
} 