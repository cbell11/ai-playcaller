"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Check, Trash2, Save, Eye, X, RefreshCw, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { getTerminology, addTerminology, updateTerminology, batchUpdateTerminology, deleteTerminology, initializeDefaultTerminology, Terminology, testSupabaseConnection, updateFormationConcepts, getDefaultTeamFormations } from "@/lib/terminology"
import { updatePlayPoolTerminology } from "@/lib/playpool"
import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'

// Helper function to generate a random 6-letter code
function generateJoinCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Default team that contains base terminology
const DEFAULT_TEAM_ID = '8feef3dc-942f-4bc5-b526-0b39e14cb683';

// Extend Terminology interface to include UI state
interface TerminologyWithUI extends Terminology {
  isEditing?: boolean
  isDirty?: boolean  // Track if this term has unsaved changes
  isSelected?: boolean // Track if the formation is selected by the user
}

interface TerminologySetProps {
  title: string
  terms: TerminologyWithUI[]
  category: string
  onUpdate: (terms: TerminologyWithUI[]) => void
  supabase: SupabaseClient
  setProfileInfo?: (info: {team_id: string | null}) => void
  setTeamCode?: (code: string | null) => void
  setTeamName?: (name: string | null) => void
}

const TerminologySet: React.FC<TerminologySetProps> = ({ title, terms, category, onUpdate, supabase, setProfileInfo, setTeamCode, setTeamName }) => {
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{url: string, concept: string} | null>(null)
  const [defaultFormations, setDefaultFormations] = useState<Terminology[]>([])
  const [defaultFormTags, setDefaultFormTags] = useState<Terminology[]>([])
  const [localTerms, setLocalTerms] = useState<TerminologyWithUI[]>(terms)
  const [userInfo, setUserInfo] = useState<{id: string | null, email: string | null, team_id: string | null}>({id: null, email: null, team_id: null})
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [hasDeleted, setHasDeleted] = useState(false) // Track if any items have been deleted
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null) // Track success message
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null) // Track timeout for message

  // Get user info when component mounts
  useEffect(() => {
    const getUserInfo = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Session in useEffect:', session) // Debug log
      if (session?.user) {
        console.log('User ID:', session.user.id) // Debug log
        console.log('User Email:', session.user.email) // Debug log
        
        // Get the user's team_id from profiles table
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('team_id')
          .eq('id', session.user.id)
          .single()
        
        if (profileError) {
          console.error('Error fetching profile:', profileError)
        }
        
        console.log('Profile Data:', profileData)
        
        setUserInfo({
          id: session.user.id || null,
          email: session.user.email || null,
          team_id: profileData?.team_id || null
        })
      } else {
        console.log('No session found') // Debug log
      }
    }
    getUserInfo()
  }, [supabase])

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
    }
    checkAuth()
  }, [supabase])

  useEffect(() => {
    if (category === "formations" || category === "form_tags") {
      console.log(`Getting default team ${category} for category:`, category);
      
      const loadItems = async () => {
        try {
          // Get items for the default team
          const { data: items, error: itemsError } = await supabase
            .from('terminology')
            .select('*')
            .eq('category', category)
            .eq('team_id', DEFAULT_TEAM_ID);

          if (itemsError) {
            console.error(`Error loading default ${category}:`, itemsError);
            return;
          }

          console.log(`Received ${category} from default team:`, items);
          if (category === "formations") {
            setDefaultFormations(items || []);
          } else if (category === "form_tags") {
            setDefaultFormTags(items || []);
          }
        } catch (error) {
          console.error(`Error loading team ${category}:`, error);
        }
      };
      
      loadItems();
    }
  }, [category, supabase]);

  // Update local terms when props change
  useEffect(() => {
    console.log(`Setting localTerms for ${category}:`, terms);
    
    // For formations and form_tags, mark terms that are associated with the user's team as selected
    if (category === "formations" || category === "form_tags") {
      const userTeamId = userInfo.team_id;
      const termsWithSelection = terms.map(term => ({
        ...term,
        isSelected: term.team_id === userTeamId // Mark as selected if it's already saved to user's team
      }));
      setLocalTerms(termsWithSelection);
    } else {
      setLocalTerms(terms);
    }
  }, [terms, category, userInfo.team_id])

  // Get available items that haven't been selected yet
  const getAvailableItems = () => {
    if (category === "formations") {
      console.log('Current default formations:', defaultFormations);
      const selectedConcepts = localTerms.map(term => term.concept);
      console.log('Selected concepts:', selectedConcepts);
      const available = defaultFormations.filter(formation => !selectedConcepts.includes(formation.concept));
      console.log('Available formations:', available);
      return available;
    } else if (category === "form_tags") {
      console.log('Current default form tags:', defaultFormTags);
      const selectedConcepts = localTerms.map(term => term.concept);
      console.log('Selected concepts:', selectedConcepts);
      const available = defaultFormTags.filter((tag: Terminology) => !selectedConcepts.includes(tag.concept));
      console.log('Available form tags:', available);
      return available;
    }
    return [];
  }

  const addRow = () => {
    if (category === "formations" || category === "form_tags") {
      const defaultItems = category === "formations" ? defaultFormations : defaultFormTags;
      
      if (defaultItems.length === 0) {
        console.log(`No default ${category} available`);
        return; // Don't add if no default items exist at all
      }

      // Find the first unselected item if possible
      const availableItems = getAvailableItems();
      const itemToUse = availableItems.length > 0 
        ? availableItems[0] 
        : defaultItems[0]; // Use first default item if all are selected
      
      const newTerm: TerminologyWithUI = {
        id: crypto.randomUUID(),
        concept: itemToUse.concept || '',
        label: itemToUse.label || '',
        category: category,
        is_enabled: true,
        isDirty: true,
        isEditing: true,
        isSelected: true,
        ...(category === "formations" && itemToUse.image_url ? { image_url: itemToUse.image_url } : {})
      }
      setLocalTerms([...localTerms, newTerm])
      onUpdate([...localTerms, newTerm])
    } else {
      const newTerm: TerminologyWithUI = {
        id: crypto.randomUUID(),
        concept: '',
        label: '',
        category: category,
        is_enabled: true,
        isDirty: true,
        isEditing: true
      }
      setLocalTerms([...localTerms, newTerm])
      onUpdate([...localTerms, newTerm])
    }
  }

  const updateConcept = (term: TerminologyWithUI, newConcept: string, isSelected: boolean) => {
    if (category === "formations" || category === "form_tags") {
      const defaultItems = category === "formations" ? defaultFormations : defaultFormTags;
      const item = defaultItems.find(f => f.concept === newConcept)
      const isAlreadySelected = localTerms.some(t => t.id !== term.id && t.concept === newConcept)
      
      if (item && !isAlreadySelected) {
        // Copy properties from the default item
        const updatedTerms = localTerms.map(t => t.id === term.id ? { 
          ...term, 
          concept: item.concept || '', 
          label: item.label || '', 
          ...(category === "formations" && item.image_url ? { image_url: item.image_url } : {}),
          isDirty: true,
          isSelected: isSelected
        } : t)
        setLocalTerms(updatedTerms)
        onUpdate(updatedTerms)
      }
    } else {
      const updatedTerms = localTerms.map(t => t.id === term.id ? { ...term, concept: newConcept, isDirty: true, isSelected: isSelected } : t)
      setLocalTerms(updatedTerms)
      onUpdate(updatedTerms)
    }
  }

  const updateLabel = (term: TerminologyWithUI, newLabel: string) => {
    const updatedTerms = localTerms.map(t => t.id === term.id ? { ...term, label: newLabel, isDirty: true } : t)
    setLocalTerms(updatedTerms)
    onUpdate(updatedTerms)
  }

  const toggleEdit = (term: TerminologyWithUI) => {
    const updatedTerms = localTerms.map(t => t.id === term.id ? { ...t, isEditing: !t.isEditing } : t)
    setLocalTerms(updatedTerms)
    onUpdate(updatedTerms)
  }

  const deleteRow = (term: TerminologyWithUI) => {
    const updatedTerms = localTerms.filter(t => t.id !== term.id)
    setLocalTerms(updatedTerms)
    setHasDeleted(true) // Mark that we've deleted something
    onUpdate(updatedTerms)
  }

  const handleSaveAll = async () => {
    try {
      setIsSaving(true)
      // Clear any existing success message and timeout
      setSaveSuccess(null)
      if (saveTimeout) {
        clearTimeout(saveTimeout)
        setSaveTimeout(null)
      }
      
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('Session:', session) // Debug log
      console.log('Session Error:', sessionError) // Debug log

      if (sessionError) {
        console.error('Session error:', sessionError)
        throw new Error('Authentication error: ' + sessionError.message)
      }

      if (!session?.user?.id) {
        console.error('No user ID in session')
        throw new Error('No authenticated user found')
      }

      // Get the user's team_id from the profiles table using the session's user ID
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', session.user.id)
        .single()

      console.log('Profile Data:', profile) // Debug log
      console.log('Profile Error:', profileError) // Debug log

      // Handle case where profile doesn't exist or has error
      let teamIdToUse = profile?.team_id;
      
      if (profileError || !teamIdToUse) {
        // Use the known team ID if there's no profile or no team_id in profile
        teamIdToUse = DEFAULT_TEAM_ID;
        console.log('Using default team ID for save:', teamIdToUse);
        
        // Update the user's profile with the team ID if the profile exists
        if (!profileError) {
          console.log('Updating profile with team ID');
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ team_id: teamIdToUse })
            .eq('id', session.user.id);
            
          if (updateError) {
            console.error('Error updating profile with team ID:', updateError);
          } else {
            console.log('Successfully updated profile with team ID');
          }
        }
      }

      // If the team ID to use is the default team, create a new one for the user
      if (teamIdToUse === DEFAULT_TEAM_ID) {
        console.log('Creating new team instead of modifying default team');
        
        // Generate a random code for the team
        const joinCode = generateJoinCode();
        
        // Create a new team
        const { data: newTeam, error: teamError } = await supabase
          .from('teams')
          .insert([{ 
            name: `${session.user.email || 'User'}'s Team`,
            code: joinCode,
            created_by: session.user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();
          
        if (teamError) {
          console.error('Error creating team:', teamError);
          throw new Error('Could not create a new team: ' + teamError.message);
        }
        
        console.log('Created new team:', newTeam);
        
        // Update the user's profile with the new team_id
        const { error: updateProfileError } = await supabase
          .from('profiles')
          .update({ team_id: newTeam.id })
          .eq('id', session.user.id);
          
        if (updateProfileError) {
          console.error('Error updating profile with team_id:', updateProfileError);
          throw new Error('Could not associate user with team: ' + updateProfileError.message);
        }
        
        teamIdToUse = newTeam.id;
        console.log('Using new team ID:', teamIdToUse);
        
        // Update UI state
        if (setProfileInfo) {
          setProfileInfo({ team_id: teamIdToUse });
        }
        
        // Update team code and name in the UI
        if (setTeamCode) setTeamCode(joinCode);
        if (setTeamName) setTeamName(newTeam.name);
        
        // Show team code in success message
        setSaveSuccess(`Team created with Join Code: ${joinCode}. You can share this code with others to join your team.`);
        
        // Clear success message after 10 seconds
        const timeout = setTimeout(() => {
          setSaveSuccess(null);
        }, 10000);
        
        setSaveTimeout(timeout);
      }

      // Check if we have any changes (either dirty terms or deletions)
      const dirtyTerms = localTerms.filter(term => term.isDirty);
      
      // Early return if there are no changes to save
      if (category === "formations" || category === "form_tags") {
        // For formations and form_tags, continue if there are either dirty terms or deletions
        if (dirtyTerms.length === 0 && !hasDeleted) {
          console.log(`No changes to save for ${category}`);
          return;
        }
      } else {
        // For other categories, still require dirty terms
        if (dirtyTerms.length === 0) {
          console.log("No changes to save for", category);
          return;
        }
      }

      if (category === "formations" || category === "form_tags") {
        console.log(`Saving ${category} for team:`, teamIdToUse);
        
        // For formations and form_tags, we're going to copy from the default team based on the user's current selection
        
        // 1. Get all the concepts the user wants to keep (whether dirty or not)
        // This properly handles deletions by only keeping what's in localTerms
        const keepConcepts = localTerms.map(term => term.concept);
        console.log(`Keeping ${category} concepts:`, keepConcepts);
        console.log('Current localTerms count:', localTerms.length);
        console.log('User had deleted items:', hasDeleted);
        
        // 2. Get the complete data from the default team
        const { data: defaultItems, error: defaultItemsError } = await supabase
          .from('terminology')
          .select('*')
          .eq('category', category)
          .eq('team_id', DEFAULT_TEAM_ID);
          
        if (defaultItemsError) {
          console.error(`Error fetching default ${category}:`, defaultItemsError);
          throw new Error(`Could not fetch default ${category}: ` + defaultItemsError.message);
        }
        
        if (!defaultItems || defaultItems.length === 0) {
          console.error(`No default ${category} found to copy from`);
          throw new Error(`No default ${category} found to copy from`);
        }
        
        console.log(`Found ${defaultItems.length} ${category} in default team`);
        
        // 3. Create new records by copying from default team and changing team_id
        // Use all of the user's current items, not just dirty ones
        const itemsToSave = defaultItems
          .filter(item => keepConcepts.includes(item.concept))
          .map(item => {
            // Find the matching local term to get any customized label
            const localTerm = localTerms.find(term => term.concept === item.concept);
            
            // Only include essential fields that definitely exist in the database
            const saveItem = {
              concept: item.concept,
              // Use the customized label if available, otherwise use the default
              label: localTerm?.label || item.label,
              category: category,
              team_id: teamIdToUse,
            };
            
            // Add image_url only for formations and only if it exists
            if (category === "formations" && item.image_url) {
              return { ...saveItem, image_url: item.image_url };
            }
            
            return saveItem;
          });
          
        console.log(`Copying ${itemsToSave.length} ${category} from default team to user's team`);
        
        // 4. Delete any existing items for this team
        const { error: deleteError } = await supabase
          .from('terminology')
          .delete()
          .eq('category', category)
          .eq('team_id', teamIdToUse)

        if (deleteError) {
          console.error('Delete error:', deleteError)
          throw new Error(`Error deleting existing ${category}: ` + deleteError.message)
        }

        // 5. Insert the copied items
        const { data: insertedItems, error: insertError } = await supabase
          .from('terminology')
          .insert(itemsToSave)
          .select();

        if (insertError) {
          console.error('Insert error:', insertError)
          throw new Error(`Error inserting copied ${category}: ` + insertError.message)
        }
        
        console.log(`Successfully saved ${insertedItems?.length || 0} ${category} for team ${teamIdToUse}`);
        console.log(`Saved ${category}:`, insertedItems?.map(f => f.concept) || []);
        console.log(`Expected to save ${category}:`, keepConcepts);
        
        // Show success message after saving
        const successMessage = hasDeleted 
          ? `Successfully saved changes. ${insertedItems?.length || 0} ${category} saved, items were removed.`
          : `Successfully saved ${insertedItems?.length || 0} ${category}!`;
        
        setSaveSuccess(successMessage);
        
        // Clear success message after 5 seconds
        const timeout = setTimeout(() => {
          setSaveSuccess(null);
        }, 5000);
        
        setSaveTimeout(timeout);
        
        // After saving, verify if any items for this team remained
        const { data: verifyItems, error: verifyError } = await supabase
          .from('terminology')
          .select('*')
          .eq('category', category)
          .eq('team_id', teamIdToUse);
          
        if (verifyError) {
          console.error(`Error verifying saved ${category}:`, verifyError);
        } else {
          console.log(`After save: Found ${verifyItems?.length || 0} ${category} for team ${teamIdToUse}`);
          console.log(`${category} concepts after save:`, verifyItems?.map(f => f.concept) || []);
        }

        // 6. Update local state to reflect the changes
        const updatedTerms = localTerms.map(term => {
          // Find the matching item we just copied
          const matchingInserted = insertedItems?.find(f => f.concept === term.concept);
          
          if (matchingInserted) {
            // Return the copied item with UI state
            return {
              ...matchingInserted,
              isDirty: false,
              isEditing: false
            };
          } else {
            // Just clear dirty flag for other items
            return {
              ...term,
              isDirty: false
            };
          }
        });
        
        setLocalTerms(updatedTerms);
        setHasDeleted(false); // Reset delete flag after saving
        onUpdate(updatedTerms);
      } else {
        // For non-formations, update existing records
        await batchUpdateTerminology(
          dirtyTerms.map(term => ({
            id: term.id,
            concept: term.concept,
            label: term.label
          }))
        )
        
        // Update local state to remove dirty flags
        const updatedTerms = localTerms.map(term => ({
          ...term,
          isDirty: false
        }))
        setLocalTerms(updatedTerms)
        setHasDeleted(false); // Reset delete flag after saving
        onUpdate(updatedTerms)

        // Show success message
        setSaveSuccess(`Successfully saved changes to ${category}!`);
        
        // Clear success message after 5 seconds
        const timeout = setTimeout(() => {
          setSaveSuccess(null);
        }, 5000);
        
        setSaveTimeout(timeout);
      }
      
      // Force reload formations after save
      if (category === "formations" || category === "form_tags") {
        setTimeout(() => {
          forceReloadFormations();
        }, 500);
      }
    } catch (error) {
      console.error('Error in handleSaveAll:', error)
      alert(error instanceof Error ? error.message : 'An error occurred while saving')
    } finally {
      setIsSaving(false)
    }
  }

  const forceReloadFormations = async () => {
    if (category === "formations" || category === "form_tags") {
      try {
        console.log(`Force reloading ${category}...`);
        
        // Always use the default team ID
        const DEFAULT_TEAM_ID = '8feef3dc-942f-4bc5-b526-0b39e14cb683';
        console.log(`Using default team ID for ${category}:`, DEFAULT_TEAM_ID);
        
        const items = await getDefaultTeamFormations();
        console.log(`Force reloaded ${category}:`, items);
        if (category === "formations") {
          setDefaultFormations(items);
        }
      } catch (error) {
        console.error(`Error force reloading ${category}:`, error);
      }
    }
  };

  // Handle resetting formations to default (deleting user's team formations)
  const handleResetToDefault = async () => {
    if ((category !== "formations" && category !== "form_tags") || !userInfo.team_id || userInfo.team_id === DEFAULT_TEAM_ID) {
      console.log(`Cannot reset ${category}: not on formations/form_tags tab, no team id, or already using default team`);
      return;
    }

    try {
      setIsResetting(true);
      console.log(`Resetting ${category} for team`, userInfo.team_id);

      // Delete all items for the user's team
      const { error: deleteError } = await supabase
        .from('terminology')
        .delete()
        .eq('category', category)
        .eq('team_id', userInfo.team_id);

      if (deleteError) {
        console.error(`Error deleting ${category}:`, deleteError);
        throw new Error(`Failed to reset ${category}: ` + deleteError.message);
      }

      // Force reload after reset
      await forceReloadFormations();

      // Show success message
      setSaveSuccess(`Successfully reset ${category} to default!`);
      
      // Clear success message after 5 seconds
      const timeout = setTimeout(() => {
        setSaveSuccess(null);
      }, 5000);
      
      setSaveTimeout(timeout);

      // Update local state
      setLocalTerms([]);
      onUpdate([]);
      setHasDeleted(false);
    } catch (error) {
      console.error(`Error resetting ${category}:`, error);
      alert(error instanceof Error ? error.message : `An error occurred while resetting ${category}`);
    } finally {
      setIsResetting(false);
      setShowResetConfirm(false);
    }
  };

  // Force loading of formations as soon as component mounts
  useEffect(() => {
    if (category === "formations") {
      forceReloadFormations();
    }
  }, []);

  // Add this cleanup effect to clear the timeout when component unmounts
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  }, [saveTimeout]);

  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-xl font-bold">{title}</CardTitle>
          {(category === "formations" || category === "form_tags") && (
            <p className="text-sm text-gray-500 mt-1">
              Select the {category === "formations" ? "formations" : "formation tags"} you want to use in your playbook.
              You can add any {category === "formations" ? "formation" : "tag"} from the default team, including duplicates with different names.
              <span className="block mt-1 italic">Click the edit button (pencil icon) or double-click on a name to customize {category === "formations" ? "formation" : "tag"} names.</span>
            </p>
          )}
          {/* Display success message if present */}
          {saveSuccess && (
            <div className="mt-2 text-sm bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded flex items-center">
              <Check className="h-4 w-4 mr-2 text-green-600" />
              {saveSuccess}
            </div>
          )}
          {userInfo.id ? (
            <div className="text-sm bg-blue-50 p-2 rounded mt-2">
              <div className="font-medium text-blue-700">Debug Info:</div>
              <div className="text-blue-600">User ID: {userInfo.id}</div>
              {userInfo.email && <div className="text-blue-600">Email: {userInfo.email}</div>}
              <div className="text-blue-600">
                Team ID: {userInfo.team_id || 'Not assigned'}
                {userInfo.team_id === DEFAULT_TEAM_ID && <span className="ml-1 text-green-600">(Default Team)</span>}
                {!userInfo.team_id && <span className="ml-1 text-yellow-600">(Using Default Team)</span>}
              </div>
              {category === "formations" && (
                <div className="text-blue-600 border-t border-blue-200 mt-1 pt-1">
                  <div className="font-medium">Formations Debug:</div>
                  <div>Available formations: {defaultFormations.length}</div>
                  <details className="mt-1">
                    <summary className="cursor-pointer font-medium">Formation List</summary>
                    <div className="pl-2 mt-1 text-xs max-h-40 overflow-y-auto">
                      {defaultFormations.map((f, idx) => (
                        <div key={idx} className="mb-1">
                          <span className="font-medium">{f.concept}:</span> {f.label}
                          {f.team_id === DEFAULT_TEAM_ID && <span className="ml-1 text-green-600">(Default Team)</span>}
                          {f.team_id && f.team_id !== DEFAULT_TEAM_ID && <span className="ml-1 text-blue-600">(Team: {f.team_id.substring(0,8)}...)</span>}
                          {!f.team_id && <span className="ml-1 text-gray-600">(Global)</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                  <div className="mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={forceReloadFormations}
                      className="bg-blue-100"
                    >
                      Reload Formations
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm bg-red-50 p-2 rounded mt-2">
              <div className="text-red-600">No user session found</div>
            </div>
          )}
        </div>
        <div className="flex space-x-2 items-center">
          {(localTerms.some(term => term.isDirty) || hasDeleted) && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </>
              )}
            </Button>
          )}
          {category === "formations" || category === "form_tags" ? (
            <div>
              {/* Formation info, but no button here */}
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={addRow}
              className="text-blue-600 hover:text-blue-800"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Row
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="grid grid-cols-[2fr_1fr_auto_auto_auto] gap-4 font-medium mb-2 px-2">
            {category === "formations" || category === "form_tags" ? (
              <>
                <div>{category === "formations" ? "Formation" : "Formation Tag"}</div>
                <div>Customized Name</div>
              </>
            ) : (
              <>
                <div>Concept</div>
                <div>Label</div>
              </>
            )}
            <div></div>
            <div></div>
            <div></div>
          </div>

          {localTerms.map((term) => (
            <div key={`row-${term.id}`} className="grid grid-cols-[2fr_1fr_auto_auto_auto] gap-4 items-center py-2 border-b">
              <div key={`concept-${term.id}`}>
                {term.isEditing || category === "formations" || category === "form_tags" ? (
                  category === "formations" || category === "form_tags" ? (
                    <div>
                      <Select
                        value={term.concept || ''}
                        onValueChange={(value) => updateConcept(term, value, true)}
                        disabled={false}
                      >
                        <SelectTrigger className="h-9 w-full bg-white border-gray-200 hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors duration-200">
                          <SelectValue placeholder={`Select ${category === "formations" ? "formation" : "tag"}`} />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-200 shadow-lg rounded-md">
                          {category === "formations" ? (
                            defaultFormations && defaultFormations.length > 0 ? (
                              defaultFormations.map((formation) => {
                                // Check if this formation is selected by another row
                                const isSelected = localTerms.some(t => t.id !== term.id && t.concept === formation.concept);
                                return (
                                  <SelectItem 
                                    key={formation.concept} 
                                    value={formation.concept || ''}
                                    disabled={isSelected}
                                    className="cursor-pointer px-3 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors duration-150 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed data-[state=checked]:bg-green-50 [&>span]:pl-6"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">{formation.concept}</span>
                                      {isSelected && (
                                        <span className="text-xs text-gray-400 ml-2">(already selected)</span>
                                      )}
                                    </div>
                                  </SelectItem>
                                )
                              })
                            ) : (
                              <div className="p-3 text-red-500">
                                No formations found. Please try reloading.
                              </div>
                            )
                          ) : defaultFormTags && defaultFormTags.length > 0 ? (
                            defaultFormTags.map((tag) => {
                              // Check if this tag is selected by another row
                              const isSelected = localTerms.some(t => t.id !== term.id && t.concept === tag.concept);
                              return (
                                <SelectItem 
                                  key={tag.concept} 
                                  value={tag.concept || ''}
                                  disabled={isSelected}
                                  className="cursor-pointer px-3 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors duration-150 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed data-[state=checked]:bg-green-50 [&>span]:pl-6"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{tag.concept}</span>
                                    {isSelected && (
                                      <span className="text-xs text-gray-400 ml-2">(already selected)</span>
                                    )}
                                  </div>
                                </SelectItem>
                              )
                            })
                          ) : (
                            <div className="p-3 text-red-500">
                              No form tags found. Please try reloading.
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <Input 
                      key={`concept-input-${term.id}`}
                      value={term.concept} 
                      onChange={(e) => updateConcept(term, e.target.value, false)} 
                      className="h-9" 
                    />
                  )
                ) : (
                  <span key={`concept-text-${term.id}`} className="text-gray-600">
                    {term.concept}
                  </span>
                )}
              </div>
              <div key={`label-${term.id}`}>
                {term.isEditing ? (
                  <Input 
                    key={`label-input-${term.id}`}
                    value={term.label} 
                    onChange={(e) => updateLabel(term, e.target.value)} 
                    className="h-9" 
                    placeholder={category === "formations" ? "Customize formation name" : "Enter label"}
                  />
                ) : (
                  <span 
                    key={`label-text-${term.id}`} 
                    className={`${term.isDirty ? "text-yellow-600 font-medium" : ""} cursor-pointer`}
                    onDoubleClick={() => toggleEdit(term)}
                  >
                    {term.label}
                  </span>
                )}
              </div>
              <Button
                key={`view-btn-${term.id}`}
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (term.image_url) {
                    setSelectedImage({url: term.image_url, concept: term.concept || ''})
                  }
                }}
                disabled={!term.image_url}
                className="hover:bg-yellow-50"
              >
                <Eye className="h-4 w-4 text-yellow-500" />
                <span className="sr-only">View concept</span>
              </Button>
              <Button
                key={`edit-btn-${term.id}`}
                variant="ghost"
                size="icon"
                onClick={() => toggleEdit(term)}
              >
                {term.isEditing ? <Check className="h-4 w-4 text-green-500" /> : <Pencil className="h-4 w-4" />}
                <span className="sr-only">{term.isEditing ? "Save" : "Edit"}</span>
              </Button>
              <Button
                key={`delete-btn-${term.id}`}
                variant="ghost"
                size="icon"
                onClick={() => deleteRow(term)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          ))}
        </div>

        {category === "formations" || category === "form_tags" ? (
          <div>
            <Button variant="outline" onClick={addRow}>
              <Plus className="h-4 w-4 mr-2" />
              Add {category === "formations" ? "Formation" : "Formation Tag"}
            </Button>
            
            <div className="text-center text-sm text-gray-600 mt-2">
              {category === "formations" ? (
                defaultFormations.length === 0 ? (
                  <div className="text-red-600">
                    No default formations available
                  </div>
                ) : getAvailableItems().length === 0 ? (
                  <div className="text-amber-600">
                    All formations have been selected (you can still add duplicates)
                  </div>
                ) : (
                  <div>
                    {getAvailableItems().length} more formation{getAvailableItems().length !== 1 ? 's' : ''} available
                  </div>
                )
              ) : (
                defaultFormTags.length === 0 ? (
                  <div className="text-red-600">
                    No default formation tags available
                  </div>
                ) : getAvailableItems().length === 0 ? (
                  <div className="text-amber-600">
                    All formation tags have been selected (you can still add duplicates)
                  </div>
                ) : (
                  <div>
                    {getAvailableItems().length} more formation tag{getAvailableItems().length !== 1 ? 's' : ''} available
                  </div>
                )
              )}
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={addRow}>
            <Plus className="h-4 w-4 mr-2" />
            Add Row
          </Button>
        )}
      </CardContent>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">
              {selectedImage?.concept}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center p-4">
            {selectedImage && (
              <img 
                src={selectedImage.url} 
                alt={selectedImage.concept} 
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg border-2 border-black"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default function SetupPage() {
  const router = useRouter()
  const [terminologyState, setTerminologyState] = useState<Record<string, TerminologyWithUI[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedSections, setSavedSections] = useState<Record<string, boolean>>({})
  const [savingCategories, setSavingCategories] = useState<Record<string, boolean>>({})
  const [needsPlayPoolUpdate, setNeedsPlayPoolUpdate] = useState(false)
  const [updatingPlayPool, setUpdatingPlayPool] = useState(false)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [profileInfo, setProfileInfo] = useState<{team_id: string | null}>({team_id: null})
  const [teamCode, setTeamCode] = useState<string | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)

  // Create Supabase client in the browser
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Supabase Session:', session) // Debug log
      console.log('Session User:', session?.user) // Debug log
      if (session?.user) {
        console.log('User ID:', session.user.id) // Debug log
        setUserId(session.user.id)
      } else {
        console.log('No session or user found') // Debug log
      }
    }
    getUserId()
  }, [supabase])

  // Extract the loadTerminology function so it can be reused
  const loadTerminology = async () => {
    try {
      setIsLoading(true);
      
      // Test connection first
      console.log('Testing Supabase connection...')
      const isConnected = await testSupabaseConnection()
      if (!isConnected) {
        setError('Unable to connect to Supabase. Please check your database configuration.')
        setIsLoading(false)
        return
      }
      console.log('Supabase connection successful')

      // Get user session for team ID
      const { data: { session } } = await supabase.auth.getSession()
      let userTeamId = null;
      
      // First check profile for team ID
      if (session?.user?.id) {
        console.log('Getting team_id for user:', session.user.id);
        // Get the user's team_id from profiles
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('team_id')
          .eq('id', session.user.id)
          .single()
        
        if (profileError) {
          console.error('Error fetching profile:', profileError)
        } else if (profileData?.team_id) {
          console.log('Found team_id in profile:', profileData.team_id);
          userTeamId = profileData.team_id;
          setTeamId(userTeamId);
          setProfileInfo({team_id: userTeamId});
        }
      }
      
      // If team ID not found in profile, use the known team ID
      if (!userTeamId) {
        userTeamId = DEFAULT_TEAM_ID;
        console.log('Using default team ID:', userTeamId);
        setTeamId(userTeamId);
        setProfileInfo({team_id: userTeamId});
      }

      try {
        console.log('Initializing default terminology...')
        await initializeDefaultTerminology()
        // Update formation concepts to match predefined list
        console.log('Updating formation concepts...')
        await updateFormationConcepts()
      } catch (initError) {
        console.error('Initialization error:', initError)
        setError(`Error initializing terminology: ${initError instanceof Error ? initError.message : 'Unknown initialization error'}`)
        setIsLoading(false)
        return
      }

      try {
        console.log('Fetching terminology with teamId:', userTeamId)
        
        // Check if the team has formations and form_tags
        const { data: teamFormations, error: formationsError } = await supabase
          .from('terminology')
          .select('*')
          .eq('category', 'formations')
          .eq('team_id', userTeamId)

        const { data: teamFormTags, error: formTagsError } = await supabase
          .from('terminology')
          .select('*')
          .eq('category', 'form_tags')
          .eq('team_id', userTeamId)
        
        if (formationsError) {
          console.error('Error checking for team formations:', formationsError);
        } else {
          console.log(`Team has ${teamFormations?.length || 0} formations`);
        }

        if (formTagsError) {
          console.error('Error checking for team form tags:', formTagsError);
        } else {
          console.log(`Team has ${teamFormTags?.length || 0} form tags`);
        }

        // If user has no form tags, get them from default team
        if (!teamFormTags || teamFormTags.length === 0) {
          console.log('No form tags found for user team, getting from default team');
          const { data: defaultFormTags, error: defaultFormTagsError } = await supabase
            .from('terminology')
            .select('*')
            .eq('category', 'form_tags')
            .eq('team_id', DEFAULT_TEAM_ID);

          if (defaultFormTagsError) {
            console.error('Error fetching default form tags:', defaultFormTagsError);
          } else if (defaultFormTags && defaultFormTags.length > 0) {
            console.log(`Found ${defaultFormTags.length} default form tags`);
            // Add default form tags to the user's team
            const formTagsToAdd = defaultFormTags.map(tag => ({
              ...tag,
              team_id: userTeamId,
              id: crypto.randomUUID() // Generate new IDs for the copies
            }));

            const { error: insertError } = await supabase
              .from('terminology')
              .insert(formTagsToAdd);

            if (insertError) {
              console.error('Error copying default form tags:', insertError);
            } else {
              console.log('Successfully copied default form tags to user team');
            }
          }
        }
        
        // Get terminology
        const terms = await getTerminology(userTeamId)
        console.log('Fetched terminology:', terms)
        
        // Group terms by category
        const groupedTerms = terms.reduce((acc, term) => {
          if (!term.category) return acc
          const category = term.category
          if (!acc[category]) {
            acc[category] = []
          }
          acc[category].push({ ...term, isEditing: false, isDirty: false })
          return acc
        }, {} as Record<string, TerminologyWithUI[]>)
        
        console.log('Grouped terms by category:', groupedTerms)
        console.log('Formations category has:', groupedTerms['formations']?.length || 0, 'items');
        
        setTerminologyState(groupedTerms)
        setIsLoading(false)
      } catch (fetchError) {
        console.error('Fetch error:', fetchError)
        setError(`Error fetching terminology: ${fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'}`)
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Setup error:', error)
      let errorMessage = 'An unexpected error occurred'
      
      if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`
      } else if (typeof error === 'object' && error !== null) {
        const supabaseError = error as any
        if (supabaseError.code && supabaseError.message) {
          errorMessage = `Database error (${supabaseError.code}): ${supabaseError.message}`
          if (supabaseError.hint) {
            errorMessage += `\nHint: ${supabaseError.hint}`
          }
        }
      }
      
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTerminology()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])  // We're disabling the rule because loadTerminology is defined in the component body

  useEffect(() => {
    const getUserProfileInfo = async () => {
      if (userId) {
        console.log('Fetching profile for user ID:', userId);
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('team_id, email')
            .eq('id', userId)
            .single();

          if (profileError) {
            console.error('Error fetching user profile:', profileError);
            if (profileError.code === 'PGRST116') {
              console.log('Profile not found, might need to create one');
              
              // Create a profile for this user
              const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert([{ 
                  id: userId, 
                  email: (await supabase.auth.getSession()).data.session?.user?.email 
                }])
                .select()
                .single();
                
                if (createError) {
                  console.error('Error creating profile:', createError);
                } else {
                  console.log('Created new profile:', newProfile);
                  setProfileInfo({team_id: newProfile?.team_id || null});
                }
            }
          } else {
            console.log('Found profile:', profile);
            setProfileInfo({team_id: profile?.team_id || null});
            
            // If user has a team, fetch the team details
            if (profile?.team_id) {
              const { data: teamData, error: teamError } = await supabase
                .from('teams')
                .select('name, code')
                .eq('id', profile.team_id)
                .single();
                
              if (teamError) {
                console.error('Error fetching team details:', teamError);
              } else if (teamData) {
                console.log('Found team details:', teamData);
                setTeamName(teamData.name);
                setTeamCode(teamData.code);
              }
            } else {
              console.log('User has no team ID, consider assigning one');
            }
          }
        } catch (error) {
          console.error('Unexpected error fetching profile:', error);
        }
      } else {
        console.log('No user ID available to fetch profile');
      }
    };
    
    getUserProfileInfo();
  }, [userId, supabase]);

  // Function to copy team code to clipboard
  const copyTeamCode = async () => {
    if (teamCode) {
      try {
        await navigator.clipboard.writeText(teamCode);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000); // Reset after 2 seconds
      } catch (err) {
        console.error('Failed to copy team code:', err);
      }
    }
  };

  const updateSetTerms = (category: string, newTerms: TerminologyWithUI[]) => {
    setTerminologyState(prev => ({
      ...prev,
      [category]: newTerms
    }))
  }

  const handleAddRow = (category: string) => {
    setTerminologyState(prev => ({
      ...prev,
      [category]: [
        ...(prev[category] || []),
        {
          id: crypto.randomUUID(),
          category,
          concept: '',
          label: '',
          is_enabled: true,
          isDirty: true,
          isEditing: true
        }
      ]
    }))
  }

  const handleUpdateConcept = (category: string, index: number, value: string) => {
    setTerminologyState(prev => ({
      ...prev,
      [category]: prev[category].map((term, i) => 
        i === index ? { ...term, concept: value, isDirty: true } : term
      )
    }))
  }

  const handleUpdateLabel = (category: string, index: number, value: string) => {
    setTerminologyState(prev => ({
      ...prev,
      [category]: prev[category].map((term, i) => 
        i === index ? { ...term, label: value, isDirty: true } : term
      )
    }))
  }

  const handleDeleteRow = (category: string, index: number) => {
    setTerminologyState(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index)
    }))
  }

  // Add a function to create a team for the user
  const createTeamForUser = async () => {
    if (!userId) {
      console.error('Cannot create team: No user ID available');
      return;
    }
    
    try {
      // Confirm user isn't already using the default team
      if (profileInfo.team_id === DEFAULT_TEAM_ID) {
        console.log('User is already assigned to the default team');
        alert('You are already using the default team. Creating a new team will allow you to customize your own terminology.');
      }
      
      // Get current user's email for team name
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email || 'User';
      
      // Generate a random code for the team
      const joinCode = generateJoinCode();
      
      // Create a new team
      const { data: newTeam, error: teamError } = await supabase
        .from('teams')
        .insert([{ 
          name: `${userEmail}'s Team`,
          code: joinCode,
          created_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();
        
      if (teamError) {
        console.error('Error creating team:', teamError);
        alert('Failed to create team: ' + teamError.message);
        return;
      }
      
      console.log('Created new team:', newTeam);
      
      // Update the user's profile with the new team_id
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ team_id: newTeam.id })
        .eq('id', userId);
        
      if (updateError) {
        console.error('Error updating profile with team ID:', updateError);
        alert('Failed to associate user with team: ' + updateError.message);
        return;
      }
      
      // Update local state
      setProfileInfo({ team_id: newTeam.id });
      setTeamId(newTeam.id);
      setTeamCode(joinCode);
      setTeamName(newTeam.name);
      
      // Refresh the terminology for the new team
      await loadTerminology();
      
      alert(`Team created successfully! Your Team Join Code is: ${joinCode}\nYou can share this code with others to join your team.`);
    } catch (error) {
      console.error('Unexpected error creating team:', error);
      alert('An error occurred while creating the team.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4">
        <div className="text-red-500 text-lg mb-4">Error Loading Terminology</div>
        <div className="text-gray-700 whitespace-pre-wrap text-center">{error}</div>
        <Button 
          onClick={() => window.location.reload()} 
          className="mt-4"
        >
          Try Again
        </Button>
      </div>
    )
  }

  const terminologySets = {
    formations: { title: "Formations", category: "formations" },
    form_tags: { title: "Formation Tags", category: "form_tags" },
    motions: { title: "Motions", category: "motions" },
    shifts: { title: "Shifts", category: "shifts" },
    pass_protections: { title: "Pass Protections", category: "pass_protections" },
    run_game: { title: "Run Game", category: "run_game" },
    quick_game: { title: "Quick Game", category: "quick_game" },
    dropback: { title: "Dropback Game", category: "dropback" },
    shot_plays: { title: "Shot Plays", category: "shot_plays" },
    screens: { title: "Screen Game", category: "screens" },
  }

  return (
    <div className="container mx-auto py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to AI Playcaller</h1>
        <p className="text-gray-600 mb-4">Let's get your team set up</p>
        <div className="bg-blue-50 p-4 rounded-lg mx-auto max-w-md mb-4">
          <h2 className="font-bold text-blue-800">User Information</h2>
          <p className="text-sm text-blue-700">User ID: {userId || 'Not logged in'}</p>
          <div className="text-sm text-blue-700">
            Team ID: {profileInfo.team_id || 'Not assigned'}
            {profileInfo.team_id === DEFAULT_TEAM_ID && <span className="ml-1 text-green-600">(Default Team)</span>}
            {!profileInfo.team_id && <span className="ml-1 text-yellow-600">(Using Default Team)</span>}
          </div>
          
          {teamName && (
            <div className="text-sm text-blue-700 mt-1">
              Team Name: {teamName}
            </div>
          )}
          
          {teamCode && (
            <div className="mt-3 bg-white p-3 rounded-md border border-blue-200 shadow-sm">
              <div className="text-sm font-medium text-blue-800 mb-1">Team Join Code:</div>
              <div 
                onClick={copyTeamCode}
                className="py-2 px-3 bg-blue-50 border border-blue-300 rounded-md flex items-center justify-between cursor-pointer hover:bg-blue-100 transition-colors"
              >
                <span className="font-mono text-base font-bold text-blue-700 tracking-wider">{teamCode}</span>
                <span className={`text-xs font-medium ml-2 px-2 py-1 rounded-full ${codeCopied ? 'bg-green-100 text-green-600' : 'bg-blue-200 text-blue-600'}`}>
                  {codeCopied ? 'Copied!' : 'Click to copy'}
                </span>
              </div>
              <div className="text-xs text-blue-600 mt-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Share this code with others to join your team
              </div>
            </div>
          )}
          
          {userId && !profileInfo.team_id && (
            <Button 
              onClick={createTeamForUser}
              className="mt-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Create Team
            </Button>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Terminology Setup</h1>
        <div className="flex gap-4">
          {needsPlayPoolUpdate && (
            <Button 
              variant="outline"
              onClick={async () => {
                try {
                  setUpdatingPlayPool(true);
                  await updatePlayPoolTerminology();
                  setNeedsPlayPoolUpdate(false);
                } catch (error) {
                  console.error('Error updating play pool:', error);
                } finally {
                  setUpdatingPlayPool(false);
                }
              }}
              disabled={updatingPlayPool}
              className="bg-yellow-50 border-yellow-300 text-yellow-800 hover:bg-yellow-100"
            >
              {updatingPlayPool ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-yellow-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : (
                <>
                  <span className="mr-2">⚠️</span>
                  Sync Changes to Play Pool
                </>
              )}
            </Button>
          )}
          <Button 
            variant="outline"
            onClick={() => router.push('/playpool')}
          >
            Continue to Play Pool →
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(terminologySets).map(([key, { title, category }]) => (
          <TerminologySet
            key={category}
            title={title}
            terms={terminologyState[category] || []}
            category={category}
            onUpdate={(newTerms) => {
              setTerminologyState(prev => ({
                ...prev,
                [category]: newTerms
              }))
            }}
            supabase={supabase}
            setProfileInfo={setProfileInfo}
            setTeamCode={setTeamCode}
            setTeamName={setTeamName}
          />
        ))}
      </div>

      <div className="flex justify-between mt-8">
        <Button 
          variant="outline" 
          onClick={() => router.push('/')}
        >
          ← Back to Home
        </Button>
        <div className="flex gap-2">
          {needsPlayPoolUpdate && (
            <Button 
              variant="outline"
              onClick={async () => {
                try {
                  setUpdatingPlayPool(true);
                  await updatePlayPoolTerminology();
                  setNeedsPlayPoolUpdate(false);
                } catch (error) {
                  console.error('Error updating play pool:', error);
                } finally {
                  setUpdatingPlayPool(false);
                }
              }}
              disabled={updatingPlayPool}
              className="bg-yellow-50 border-yellow-300 text-yellow-800 hover:bg-yellow-100"
            >
              {updatingPlayPool ? "Updating..." : "Sync to Play Pool"}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.push('/playpool')}
          >
            Continue to Play Pool →
          </Button>
        </div>
      </div>
    </div>
  )
}
