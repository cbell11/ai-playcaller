"use client"

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Loader2, Plus, AlertCircle, Check, X, Shield, Trash2 } from 'lucide-react'

interface ScoutingTerm {
  id: string
  name: string
  category: 'front' | 'coverage' | 'blitz'
  description: string | null
  is_enabled: boolean
  created_at: string
  updated_at: string
}

interface NewTerm {
  name: string
  category: 'front' | 'coverage' | 'blitz'
  description: string
}

const defaultNewTerm: NewTerm = {
  name: '',
  category: 'front',
  description: ''
}

export default function ScoutingTerminologyPage() {
  const [terms, setTerms] = useState<ScoutingTerm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddTermOpen, setIsAddTermOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [termToDelete, setTermToDelete] = useState<ScoutingTerm | null>(null)
  const [newTerm, setNewTerm] = useState<NewTerm>(defaultNewTerm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState<{
    type: 'success' | 'error',
    message: string
  } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkAdminStatus()
    fetchTerms()
  }, [])

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        setError('Unauthorized: Admin access required')
        return
      }

      setIsAdmin(true)
    } catch (err) {
      console.error('Error checking admin status:', err)
      setError('Failed to check admin status')
    }
  }

  const fetchTerms = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: terms, error } = await supabase
        .from('scouting_terminology')
        .select('*')
        .order('name')

      if (error) throw error

      setTerms(terms || [])
    } catch (err) {
      console.error('Error fetching terms:', err)
      setError('Failed to fetch terminology')
    } finally {
      setLoading(false)
    }
  }

  const handleAddTerm = async () => {
    try {
      setIsSubmitting(true)
      setNotification(null)
      
      // Validate required fields
      if (!newTerm.name || !newTerm.category) {
        setNotification({
          type: 'error',
          message: "Name and Category are required fields"
        })
        return
      }

      const { error: insertError } = await supabase
        .from('scouting_terminology')
        .insert([newTerm])

      if (insertError) throw insertError

      setNewTerm(defaultNewTerm)
      setIsAddTermOpen(false)
      setNotification({
        type: 'success',
        message: "Term added successfully!"
      })

      // Clear success notification after 3 seconds
      setTimeout(() => {
        setNotification(null)
      }, 3000)

      // Refresh terms list
      fetchTerms()
    } catch (err) {
      console.error('Error adding term:', err)
      setNotification({
        type: 'error',
        message: "Failed to add term. Please try again."
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleTermStatus = async (termId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('scouting_terminology')
        .update({ is_enabled: !currentStatus })
        .eq('id', termId)

      if (error) throw error

      // Update local state
      setTerms(prev => prev.map(term => 
        term.id === termId ? { ...term, is_enabled: !currentStatus } : term
      ))
    } catch (err) {
      console.error('Error toggling term status:', err)
      setNotification({
        type: 'error',
        message: "Failed to update term status"
      })
    }
  }

  const deleteTerm = async (termId: string) => {
    try {
      const { error } = await supabase
        .from('scouting_terminology')
        .delete()
        .eq('id', termId)

      if (error) throw error

      // Update local state
      setTerms(prev => prev.filter(term => term.id !== termId))
      
      setNotification({
        type: 'success',
        message: "Term deleted successfully!"
      })

      // Clear success notification after 3 seconds
      setTimeout(() => {
        setNotification(null)
      }, 3000)
    } catch (err) {
      console.error('Error deleting term:', err)
      setNotification({
        type: 'error',
        message: "Failed to delete term"
      })
    }
  }

  const handleDeleteClick = (term: ScoutingTerm) => {
    setTermToDelete(term)
    setIsDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!termToDelete) return

    await deleteTerm(termToDelete.id)
    setIsDeleteConfirmOpen(false)
    setTermToDelete(null)
  }

  const handleAddForCategory = (category: 'front' | 'coverage' | 'blitz') => {
    setNewTerm({ ...defaultNewTerm, category })
    setIsAddTermOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-red-500">{error || 'Unauthorized access'}</div>
        </CardContent>
      </Card>
    )
  }

  const termsByCategory = terms.reduce((acc, term) => {
    if (!acc[term.category]) {
      acc[term.category] = [];
    }
    acc[term.category].push(term);
    return acc;
  }, {} as Record<string, ScoutingTerm[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Scouting Terminology
        </CardTitle>
      </CardHeader>
      <CardContent>
        {notification && (
          <div 
            className={`mb-4 p-4 rounded-md ${
              notification.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <Check className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {notification.message}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {(['front', 'coverage', 'blitz'] as const).map((category) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold capitalize">{category}s</h3>
                <Button 
                  className="bg-[#2ecc71] hover:bg-[#27ae60] text-white"
                  size="sm"
                  onClick={() => handleAddForCategory(category)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add {category}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="h-10 px-4 text-left font-medium">Name</th>
                        <th className="h-10 px-4 text-center font-medium">Status</th>
                        <th className="h-10 px-4 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(termsByCategory[category] || []).map((term) => (
                        <tr key={term.id} className="border-b last:border-0">
                          <td className="p-4">{term.name}</td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              <Switch
                                checked={term.is_enabled}
                                onCheckedChange={() => toggleTermStatus(term.id, term.is_enabled)}
                              />
                              <span className="text-sm text-gray-500">
                                {term.is_enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(term)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(!termsByCategory[category] || termsByCategory[category].length === 0) && (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-gray-500">
                            No {category}s found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Term Modal */}
        <Dialog open={isAddTermOpen} onOpenChange={(open) => {
          setIsAddTermOpen(open)
          if (!open) {
            setNotification(null)
            setNewTerm(defaultNewTerm)
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New {newTerm.category}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={newTerm.name}
                  onChange={(e) => setNewTerm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={`Enter ${newTerm.category} name`}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newTerm.description}
                  onChange={(e) => setNewTerm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description (optional)"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleAddTerm}
                disabled={isSubmitting}
                className="bg-[#2ecc71] hover:bg-[#27ae60] text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding {newTerm.category}...
                  </>
                ) : (
                  `Add ${newTerm.category}`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {termToDelete?.category}</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{termToDelete?.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
} 