"use client"

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

import { Loader2, Users, Shield, Mail, AlertTriangle, Trash2, Copy, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteUserFromAuth } from '../actions/delete-user'

interface TeamMember {
  id: string
  email: string
  role: string
  created_at: string
}

interface TeamInfo {
  id: string
  name: string
  code: string
  created_at: string
}

export default function AccountPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [isTeamDeletion, setIsTeamDeletion] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const fetchAccountData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get user data
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          router.push('/auth')
          return
        }
        setUser(user)

        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('team_id, role')
          .eq('id', user.id)
          .single()

        if (profileError || !profile?.team_id) {
          setError('No team associated with your account')
          setLoading(false)
          return
        }

        // Get team information
        const { data: team, error: teamError } = await supabase
          .from('teams')
          .select('id, name, code, created_at')
          .eq('id', profile.team_id)
          .single()

        if (teamError || !team) {
          setError('Failed to load team information')
          setLoading(false)
          return
        }
        setTeamInfo(team)

        // Get team members
        const { data: members, error: membersError } = await supabase
          .from('profiles')
          .select('id, email, role, created_at')
          .eq('team_id', profile.team_id)
          .order('created_at')

        if (!membersError && members) {
          setTeamMembers(members)
        }

      } catch (err) {
        console.error('Error fetching account data:', err)
        setError('Failed to load account information')
      } finally {
        setLoading(false)
      }
    }

    fetchAccountData()
  }, [])

  const copyJoinCode = async () => {
    if (teamInfo?.code) {
      try {
        await navigator.clipboard.writeText(teamInfo.code)
        setCodeCopied(true)
        setTimeout(() => setCodeCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy join code:', err)
      }
    }
  }



  const handleDeleteAccount = async () => {
    if (!teamInfo || !user) return

    try {
      // Check if user is the only member of the team
      const isOnlyMember = teamMembers.length === 1
      
      if (isOnlyMember) {
        setDeleteMessage(
          `WARNING: You are the only member of team "${teamInfo.name}". ` +
          `Deleting your account will result in the loss of ALL team data including: ` +
          `terminology, opponents, scouting reports, and playpool data. ` +
          `This action cannot be undone. Are you sure you want to proceed?`
        )
        setIsTeamDeletion(true)
      } else {
        setDeleteMessage(
          `Are you sure you want to delete your account? ` +
          `You are part of team "${teamInfo.name}" with ${teamMembers.length} members. ` +
          `Only your account will be deleted, team data will remain.`
        )
        setIsTeamDeletion(false)
      }

      setShowDeleteModal(true)
    } catch (err) {
      console.error('Error checking team status:', err)
      setError('Failed to check team status. Please try again.')
    }
  }

  const deleteTeamData = async (teamId: string) => {
    try {
      // Delete from terminology table
      await supabase.from('terminology').delete().eq('team_id', teamId)
      // Delete from opponents table
      await supabase.from('opponents').delete().eq('team_id', teamId)
      // Delete from scouting_reports table
      await supabase.from('scouting_reports').delete().eq('team_id', teamId)
      // Delete from playpool table
      await supabase.from('playpool').delete().eq('team_id', teamId)
      // Delete the team itself
      await supabase.from('teams').delete().eq('id', teamId)
    } catch (err) {
      console.error('Error deleting team data:', err)
      throw err
    }
  }

  const confirmDeleteAccount = async () => {
    if (!user || !teamInfo) return

    try {
      setDeletingAccount(true)
      setError(null)

      // Delete from Supabase Auth using server action
      const authResult = await deleteUserFromAuth(user.id)
      if (!authResult.success) {
        console.error('Auth deletion error:', authResult.error)
      }

      // Delete profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id)

      if (profileError) {
        console.error('Profile deletion error:', profileError)
        throw profileError
      }

      // If this was a team deletion, clean up all team data
      if (isTeamDeletion) {
        await deleteTeamData(teamInfo.id)
      }

      // Sign out and redirect
      await supabase.auth.signOut()
      window.location.href = '/auth'

    } catch (err) {
      console.error('Error deleting account:', err)
      setError('Failed to delete account. Please try again.')
      setDeletingAccount(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error && !teamInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Account Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Account Management</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm font-medium text-gray-700">Email</Label>
              <p className="mt-1 text-sm text-gray-900">{user?.email}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Team Name</Label>
              <p className="mt-1 text-sm text-gray-900">{teamInfo?.name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Team Join Code</Label>
              <div className="mt-1 flex items-center gap-2">
                <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                  {teamInfo?.code}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyJoinCode}
                  className="flex items-center gap-1 cursor-pointer"
                >
                  {codeCopied ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Team Members</Label>
              <p className="mt-1 text-sm text-gray-900">{teamMembers.length} member(s)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{member.email}</p>
                  <p className="text-sm text-gray-500">
                    {member.id === user?.id ? 'You' : 'Team Member'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {member.role === 'admin' && (
                    <Shield className="h-4 w-4 text-blue-500" />
                  )}
                  <span className="px-2 py-1 bg-white rounded text-xs font-medium">
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contact Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Contact Support
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Contact our support team for assistance:
            </p>
            <div className="flex items-center justify-between">
              <a 
                href="mailto:justin@american-football-academy.com" 
                className="text-blue-600 hover:underline font-medium"
              >
                justin@american-football-academy.com
              </a>
              <Button
                asChild
                className="flex items-center gap-2 cursor-pointer"
              >
                <a href="mailto:justin@american-football-academy.com">
                  <Mail className="h-4 w-4" />
                  Send Message
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Deletion */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-6 w-6" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <Button
              onClick={handleDeleteAccount}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white border-red-500 hover:border-red-600 cursor-pointer"
            >
              <Trash2 className="h-4 w-4 text-white" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {isTeamDeletion ? 'Delete Account & Team' : 'Delete Account'}
                </h3>
                <p className="text-sm text-gray-500">
                  This action cannot be undone
                </p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {deleteMessage}
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false)
                  setIsTeamDeletion(false)
                  setDeleteMessage('')
                }}
                disabled={deletingAccount}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeleteAccount}
                disabled={deletingAccount}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white border-red-500 hover:border-red-600 cursor-pointer"
              >
                {deletingAccount ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 text-white" />
                    Delete Account
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