"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from '@supabase/ssr'
import { PlusCircle } from "lucide-react"
import { v4 as uuidv4 } from 'uuid'
import { addOpponent, getOpponentsByTeamId, getOpponentById } from '../actions/opponents'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"

interface Opponent {
  id: string
  name: string
  created_at: string
  team_id?: string | null
}

export function OpponentSelect() {
  const [opponents, setOpponents] = useState<Opponent[]>([])
  const [selectedOpponent, setSelectedOpponent] = useState<string>("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newOpponentName, setNewOpponentName] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingOpponent, setIsAddingOpponent] = useState(false)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Create Supabase client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // Fetch user data to get team_id
    const fetchUserInfo = async () => {
      setIsLoading(true)
      
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Get team_id from profile
          const { data: profileData } = await supabase
            .from('profiles')
            .select('team_id')
            .eq('id', user.id)
            .single()
          
          if (profileData?.team_id) {
            setTeamId(profileData.team_id)
            
            // Try to get previously selected opponent from localStorage first
            const savedOpponentId = localStorage.getItem('selectedOpponent')
            
            // Fetch opponents for this team using server action
            const result = await getOpponentsByTeamId(profileData.team_id)
            
            if (!result.success || !result.data) {
              console.error('Failed to fetch opponents:', result.error)
              setErrorMessage(result.error?.message || 'Failed to load opponents')
              return
            }
            
            const opponentsData = result.data
            setOpponents(opponentsData)
            
            // If we have a saved opponent ID, verify it exists and belongs to this team
            if (savedOpponentId) {
              // First check if it's in our fetched opponents list
              const existingOpponent = opponentsData.find(o => o.id === savedOpponentId)
              if (existingOpponent) {
                  setSelectedOpponent(savedOpponentId)
                return
              }
              
              // If not in the list, try to fetch it by ID
                  const opponentResult = await getOpponentById(savedOpponentId)
                  if (opponentResult.success && opponentResult.data) {
                    // If it exists and belongs to this team, add it to our list
                    if (opponentResult.data.team_id === profileData.team_id) {
                      setOpponents(prev => [...prev, opponentResult.data!])
                      setSelectedOpponent(savedOpponentId)
                  return
                }
              }
              
              // If we get here, the saved opponent is invalid
                      localStorage.removeItem('selectedOpponent')
            }
            
            // If no valid saved opponent, select the first one from the list
            if (opponentsData && opponentsData.length > 0) {
                        setSelectedOpponent(opponentsData[0].id)
                        localStorage.setItem('selectedOpponent', opponentsData[0].id)
              
              // Dispatch event to notify other components
              const event = new CustomEvent('opponentChanged', { 
                detail: { opponentId: opponentsData[0].id }
              })
              window.dispatchEvent(event)
            }
          }
        }
      } catch (error) {
        console.error('Error fetching opponents:', error)
        setErrorMessage('Failed to load opponents')
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserInfo()
  }, [supabase])

  // Add effect to handle storage changes from other components
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'selectedOpponent' && e.newValue && e.newValue !== selectedOpponent) {
        setSelectedOpponent(e.newValue)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [selectedOpponent])

  const handleOpponentChange = (value: string) => {
    if (value === "add_new") {
      setShowAddDialog(true)
    } else {
      setSelectedOpponent(value)
      localStorage.setItem('selectedOpponent', value)
      
      // Dispatch a custom event to notify other components
      const event = new CustomEvent('opponentChanged', { 
        detail: { opponentId: value }
      })
      window.dispatchEvent(event)
      
      console.log('Dispatched opponentChanged event with ID:', value)
    }
  }

  const handleAddOpponent = async () => {
    if (!newOpponentName.trim() || !teamId) return
    
    // Clear any previous errors
    setErrorMessage(null)
    setIsAddingOpponent(true)
    
    try {
      // Generate a new UUID for the opponent
      const opponentId = uuidv4()
      
      // Prepare data for server action
      const opponentData = {
        id: opponentId,
        name: newOpponentName.trim(),
        team_id: teamId
      }
      
      console.log('Attempting to add opponent via server action:', opponentData)
      
      // Call the server action
      const result = await addOpponent(opponentData)
      
      if (!result.success) {
        setErrorMessage(result.error?.message || 'Failed to add opponent')
        console.error('Server action error:', result.error)
        return
      }
      
      if (!result.data) {
        setErrorMessage('No data returned after insert')
        return
      }
      
      console.log('Successfully added opponent:', result.data)
      
      // Add the new opponent to the list
      setOpponents(prev => [...prev, result.data!])
      
      // Select the new opponent
      setSelectedOpponent(result.data.id)
      localStorage.setItem('selectedOpponent', result.data.id)
      
      // Close the dialog and reset form
      setShowAddDialog(false)
      setNewOpponentName("")

      // Redirect to setup page
      window.location.href = '/setup'
    } catch (error) {
      console.error('Error adding opponent:', error)
      if (!errorMessage) {
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred')
      }
    } finally {
      setIsAddingOpponent(false)
    }
  }

  if (isLoading) {
    return (
      <div className="px-3 py-2 text-sm text-gray-500">
        Loading opponents...
      </div>
    )
  }

  return (
    <div className="p-2">
      {errorMessage && !showAddDialog && (
        <div className="mb-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
          <p><strong>Error:</strong> {errorMessage}</p>
          <Button 
            onClick={() => setErrorMessage(null)} 
            variant="ghost" 
            className="mt-1 h-auto p-0 text-xs text-red-600 hover:text-red-800 hover:bg-transparent"
          >
            Dismiss
          </Button>
        </div>
      )}
      
      {opponents.length === 0 && !isLoading ? (
        <div className="bg-gray-50 p-3 rounded border border-gray-200 text-center">
          <p className="text-sm text-gray-600 mb-2">No opponents found</p>
          <Button 
            onClick={() => setShowAddDialog(true)} 
            size="sm" 
            className="w-full"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add First Opponent
          </Button>
        </div>
      ) : (
        <Select value={selectedOpponent} onValueChange={handleOpponentChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select opponent" />
          </SelectTrigger>
          <SelectContent>
            {opponents.length === 0 ? (
              <div className="py-2 px-2 text-sm text-gray-500">
                No opponents found. Add your first opponent.
              </div>
            ) : (
              opponents.map((opponent) => (
                <SelectItem key={opponent.id} value={opponent.id}>
                  {opponent.name}
                </SelectItem>
              ))
            )}
            <SelectItem value="add_new" className="text-blue-600 font-medium">
              <span className="flex items-center">
                <PlusCircle className="h-4 w-4 mr-2" />
                Add New Opponent
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Opponent</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Opponent Name"
              value={newOpponentName}
              onChange={(e) => setNewOpponentName(e.target.value)}
            />
            
            {errorMessage && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                <p><strong>Error:</strong> {errorMessage}</p>
                <p className="mt-1 text-xs">
                  Please check if you have the correct permissions in Supabase or if there might be an issue with the opponents table structure.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddDialog(false);
                setErrorMessage(null);
              }}
              disabled={isAddingOpponent}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddOpponent}
              disabled={isAddingOpponent || !newOpponentName.trim()}
              className="bg-[#0B2545] hover:bg-[#0B2545]/90 text-white"
            >
              {isAddingOpponent ? 'Adding...' : 'Add Opponent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 