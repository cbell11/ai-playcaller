"use client"

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, UserCog, Search, AlertCircle } from 'lucide-react'

interface Team {
  name: string
}

interface Profile {
  id: string
  email: string
  role: string
  team_id: string | null
  created_at: string
  team?: {
    name: string
  }
}

export default function AdminPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
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
        setError('Failed to check admin status')
      }
    }

    checkAdminStatus()
  }, [])

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    try {
      setSearching(true)
      setError(null)

      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          role,
          team_id,
          created_at,
          team:teams(name)
        `)
        .ilike('email', `%${searchQuery}%`)
        .order('email')
        .limit(10)

      if (error) {
        console.error('Search error:', error)
        throw error
      }

      const formattedResults = profiles?.map(profile => ({
        ...profile,
        team: profile.team && Array.isArray(profile.team) && profile.team[0] ? { name: profile.team[0].name } : undefined
      })) || []

      setSearchResults(formattedResults)
    } catch (err) {
      console.error('Search error:', err)
      setError('Failed to search users. Please try again.')
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      setError(null)
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) {
        console.error('Update role error:', error)
        throw error
      }

      setSearchResults(prevResults =>
        prevResults.map(user =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      )
    } catch (err) {
      console.error('Update role error:', err)
      setError('Failed to update user role. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-6 w-6" />
          User Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Search Section */}
          <div className="space-y-2">
            <Label>Search Users</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Search by email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    searchUsers()
                  }
                }}
                className="flex-1"
              />
              <Button 
                onClick={searchUsers}
                disabled={searching}
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-2">Search</span>
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              Search for users by their email address
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Search Results */}
          <div className="space-y-4">
            {searchResults.length > 0 ? (
              searchResults.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{profile.email}</p>
                    <p className="text-sm text-gray-500">
                      Team: {profile.team?.name || 'No team'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Select
                      value={profile.role}
                      onValueChange={(value) => updateUserRole(profile.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))
            ) : searchQuery && !searching ? (
              <div className="flex items-center justify-center p-8 text-gray-500 border rounded-lg">
                <AlertCircle className="h-5 w-5 mr-2" />
                No users found
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 