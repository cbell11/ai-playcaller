"use client"

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, UserCog, Search, AlertCircle, Trash2 } from 'lucide-react'
import { deleteUserFromAuth } from '../actions/delete-user'

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
  coachCount?: number
}

export default function AdminPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [logoUrl, setLogoUrl] = useState('https://res.cloudinary.com/dfvzvbygc/image/upload/v1756928729/AI_PLAYCALLER_yxbxer.png')
  const [dashboardLogoUrl, setDashboardLogoUrl] = useState('https://res.cloudinary.com/dfvzvbygc/image/upload/v1756918320/logo_landscape_yszdv3.png')
  const [faviconUrl, setFaviconUrl] = useState('https://res.cloudinary.com/dfvzvbygc/image/upload/v1756904350/favicon_aipc_ml6rpg.png')
  const [updatingLogo, setUpdatingLogo] = useState(false)
  const [updatingDashboardLogo, setUpdatingDashboardLogo] = useState(false)
  const [updatingFavicon, setUpdatingFavicon] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null)
  const [deletingUser, setDeletingUser] = useState(false)
  const [deleteModalMessage, setDeleteModalMessage] = useState('')
  const [isTeamDeletion, setIsTeamDeletion] = useState(false)

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

  const updateLogo = async () => {
    try {
      setUpdatingLogo(true)
      setError(null)
      
      // Update localStorage with the new logo URL
      localStorage.setItem('logoUrl', logoUrl)
      
      // Force reload to update the logo across the app
      window.location.reload()
    } catch (err) {
      console.error('Update logo error:', err)
      setError('Failed to update logo. Please try again.')
    } finally {
      setUpdatingLogo(false)
    }
  }

  const updateDashboardLogo = async () => {
    try {
      setUpdatingDashboardLogo(true)
      setError(null)
      
      // For now, we'll just update the local state and localStorage
      // In a real app, you'd want to save this to a database
      localStorage.setItem('dashboardLogoUrl', dashboardLogoUrl)
      
      // Force reload to update the dashboard logo across the app
      window.location.reload()
      } catch (err) {
      console.error('Update dashboard logo error:', err)
      setError('Failed to update dashboard logo. Please try again.')
      } finally {
      setUpdatingDashboardLogo(false)
    }
  }

  const updateFavicon = async () => {
    try {
      setUpdatingFavicon(true)
      setError(null)
      
      // For now, we'll just update the local state and localStorage
      // In a real app, you'd want to save this to a database
      localStorage.setItem('faviconUrl', faviconUrl)
      
      // Update the favicon dynamically
      const link = document.querySelector("link[rel='icon']") as HTMLLinkElement || document.createElement('link')
      link.type = 'image/png'
      link.rel = 'icon'
      link.href = faviconUrl
      document.head.appendChild(link)
      
    } catch (err) {
      console.error('Update favicon error:', err)
      setError('Failed to update favicon. Please try again.')
    } finally {
      setUpdatingFavicon(false)
    }
  }

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
          created_at
        `)
        .ilike('email', `%${searchQuery}%`)
        .order('email')
        .limit(10)

      if (error) {
        console.error('Search error:', error)
        throw error
      }

      // Get team names and coach counts for each profile
      const formattedResults = await Promise.all(
        profiles?.map(async (profile) => {
          let teamName = 'No team';
          let coachCount = 0;

          if (profile.team_id) {
            // Get team name from teams table
            const { data: teamData, error: teamError } = await supabase
              .from('teams')
              .select('name')
              .eq('id', profile.team_id)
              .single();

            if (!teamError && teamData) {
              teamName = teamData.name;
            }

            // Count coaches in this team
            const { count, error: countError } = await supabase
              .from('profiles')
              .select('*', { count: 'exact' })
              .eq('team_id', profile.team_id);

            if (!countError) {
              coachCount = count || 0;
            }
          }

          return {
        ...profile,
            team: { name: teamName },
            coachCount
          };
        }) || []
      );

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

  const checkTeamAssociation = async (teamId: string): Promise<{ count: number, shouldDeleteTeam: boolean }> => {
    try {
      // Count users associated with this team
      const { data: userCount, error: countError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' })
        .eq('team_id', teamId)

      if (countError) throw countError

      const count = userCount?.length || 0
      return { count, shouldDeleteTeam: count === 1 }
    } catch (err) {
      console.error('Error checking team association:', err)
      throw err
    }
  }

  const deleteTeamData = async (teamId: string) => {
    try {
      // Delete from terminology table
      const { error: terminologyError } = await supabase
        .from('terminology')
        .delete()
        .eq('team_id', teamId)
      
      if (terminologyError) {
        console.error('Error deleting terminology:', terminologyError)
        throw terminologyError
      }

      // Delete from opponents table
      const { error: opponentsError } = await supabase
        .from('opponents')
        .delete()
        .eq('team_id', teamId)
      
      if (opponentsError) {
        console.error('Error deleting opponents:', opponentsError)
        throw opponentsError
      }

      // Delete from scouting_reports table
      const { error: scoutingError } = await supabase
        .from('scouting_reports')
        .delete()
        .eq('team_id', teamId)
      
      if (scoutingError) {
        console.error('Error deleting scouting reports:', scoutingError)
        throw scoutingError
      }

      // Delete from playpool table
      const { error: playpoolError } = await supabase
        .from('playpool')
        .delete()
        .eq('team_id', teamId)
      
      if (playpoolError) {
        console.error('Error deleting playpool:', playpoolError)
        throw playpoolError
      }

      // Finally delete the team itself
      const { error: teamError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId)
      
      if (teamError) {
        console.error('Error deleting team:', teamError)
        throw teamError
      }

      console.log('Successfully deleted team and all associated data')
    } catch (err) {
      console.error('Error deleting team data:', err)
      throw err
    }
  }

  const handleDeleteUser = async (user: Profile) => {
    if (!user.team_id) {
      // User has no team, just delete the profile and auth user
      setDeleteModalMessage(`Are you sure you want to delete user ${user.email}?`)
      setIsTeamDeletion(false)
    } else {
      // Check team association
      try {
        const { count, shouldDeleteTeam } = await checkTeamAssociation(user.team_id)
        
        if (shouldDeleteTeam) {
          setDeleteModalMessage(
            `WARNING: This is the only user associated with team ID ${user.team_id}. ` +
            `Deleting this user will result in the loss of ALL data associated with this team including: ` +
            `terminology, opponents, scouting reports, and playpool data. ` +
            `This action cannot be undone. Are you sure you want to proceed?`
          )
          setIsTeamDeletion(true)
        } else {
          setDeleteModalMessage(
            `Are you sure you want to delete user ${user.email}? ` +
            `This user is part of a team with ${count} members. Only the user profile will be deleted.`
          )
          setIsTeamDeletion(false)
        }
      } catch (err) {
        console.error('Error checking team association:', err)
        setError('Failed to check team association. Please try again.')
        return
      }
    }
    
    setUserToDelete(user)
    setShowDeleteModal(true)
  }

  const confirmDeleteUser = async () => {
    if (!userToDelete) return

    try {
      setDeletingUser(true)
      setError(null)

      // Delete from Supabase Auth using server action
      const authResult = await deleteUserFromAuth(userToDelete.id)
      
      if (!authResult.success) {
        console.error('Error deleting auth user:', authResult.error)
        // If auth deletion fails, we might still want to delete the profile
        // This could happen if the user was already deleted from auth
        console.log('Auth deletion failed, attempting profile deletion anyway...')
      }

      // Delete profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userToDelete.id)

      if (profileError) {
        console.error('Error deleting profile:', profileError)
        throw profileError
      }

      // If this was a team deletion, clean up all team data
      if (isTeamDeletion && userToDelete.team_id) {
        await deleteTeamData(userToDelete.team_id)
      }

      // Remove from search results
      setSearchResults(prevResults =>
        prevResults.filter(user => user.id !== userToDelete.id)
      )

      // Clear search query if no results left
      if (searchResults.length === 1) {
        setSearchQuery('')
      }

      setShowDeleteModal(false)
      setUserToDelete(null)
      setIsTeamDeletion(false)
      setDeleteModalMessage('')
      
    } catch (err) {
      console.error('Error deleting user:', err)
      setError('Failed to delete user. Please try again.')
    } finally {
      setDeletingUser(false)
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
    <div className="space-y-6">
      {/* User Management Card */}
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
                      {profile.team_id && (
                        <p className="text-sm text-gray-500">
                          Number of Coaches in Team: {profile.coachCount || 0}
                        </p>
                      )}
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
                      <Button
                        size="sm"
                        onClick={() => handleDeleteUser(profile)}
                        className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white border-red-500 hover:border-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
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

      {/* Brand Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M20.4 14.5L16 10 4 20" />
            </svg>
            Brand Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Logo Management */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="logoUrl">Login Page Logo URL</Label>
                <p className="text-sm text-gray-500 mb-2">
                  Update the logo displayed on the login page
                </p>
                <div className="flex gap-2">
                  <Input
                    id="logoUrl"
                    placeholder="Enter logo image URL..."
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={updateLogo}
                    disabled={updatingLogo || !logoUrl.trim()}
                  >
                    {updatingLogo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Update Logo'
                    )}
                  </Button>
                </div>
                {logoUrl && (
                  <div className="mt-2">
                    <img 
                      src={logoUrl} 
                      alt="Logo preview" 
                      className="h-16 w-auto border rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Dashboard Logo Management */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="dashboardLogoUrl">Dashboard Logo URL</Label>
                <p className="text-sm text-gray-500 mb-2">
                  Update the logo displayed in the sidebar navigation
                </p>
                <div className="flex gap-2">
                  <Input
                    id="dashboardLogoUrl"
                    placeholder="Enter dashboard logo image URL..."
                    value={dashboardLogoUrl}
                    onChange={(e) => setDashboardLogoUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={updateDashboardLogo}
                    disabled={updatingDashboardLogo || !dashboardLogoUrl.trim()}
                  >
                    {updatingDashboardLogo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Update Dashboard Logo'
                    )}
                  </Button>
                </div>
                {dashboardLogoUrl && (
                  <div className="mt-2">
                    <img 
                      src={dashboardLogoUrl} 
                      alt="Dashboard logo preview" 
                      className="h-8 w-auto border rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
            </div>
          )}
              </div>
            </div>

            {/* Favicon Management */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="faviconUrl">Favicon URL</Label>
                <p className="text-sm text-gray-500 mb-2">
                  Update the favicon displayed in browser tabs
                </p>
                <div className="flex gap-2">
                  <Input
                    id="faviconUrl"
                    placeholder="Enter favicon image URL..."
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={updateFavicon}
                    disabled={updatingFavicon || !faviconUrl.trim()}
                  >
                    {updatingFavicon ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Update Favicon'
                    )}
                  </Button>
                </div>
                {faviconUrl && (
                  <div className="mt-2">
                    <img 
                      src={faviconUrl} 
                      alt="Favicon preview" 
                      className="h-8 w-8 border rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete User Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {isTeamDeletion ? 'Delete User & Team' : 'Delete User'}
                </h3>
                <p className="text-sm text-gray-500">
                  {isTeamDeletion ? 'This action will delete the user and all team data' : 'This action will delete the user profile'}
                </p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {deleteModalMessage}
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false)
                  setUserToDelete(null)
                  setIsTeamDeletion(false)
                  setDeleteModalMessage('')
                }}
                disabled={deletingUser}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteUser}
                disabled={deletingUser}
                className="flex items-center gap-2"
              >
                {deletingUser ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 