"use client"

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ImageIcon } from 'lucide-react'

interface ScoutingTerminology {
  id: string
  name: string
  type: 'front' | 'coverage' | 'blitz'
}

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

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
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

    fetchScoutingTerminology()
  }, [])

  const handleSubmitScoutCard = async () => {
    if (!selectedFront || !imageUrl) {
      setSubmitError('Please select a front and provide an image URL')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const { error } = await supabase
        .from('scout_cards')
        .insert({
          front: selectedFront,
          coverage: selectedCoverage === 'None' ? null : selectedCoverage,
          blitz: selectedBlitz === 'None' ? null : selectedBlitz,
          image_url: imageUrl
        })

      if (error) throw error

      // Reset form
      setSelectedFront('')
      setSelectedCoverage('')
      setSelectedBlitz('')
      setImageUrl('')
      setSubmitError(null)

    } catch (err) {
      console.error('Error submitting scout card:', err)
      setSubmitError('Failed to submit scout card. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
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
        </div>
      </CardContent>
    </Card>
  )
} 