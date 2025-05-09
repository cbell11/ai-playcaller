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
  const [defaultShifts, setDefaultShifts] = useState<Terminology[]>([])
  const [defaultToMotions, setDefaultToMotions] = useState<Terminology[]>([])
  const [defaultFromMotions, setDefaultFromMotions] = useState<Terminology[]>([])
  const [defaultRunGame, setDefaultRunGame] = useState<Terminology[]>([])
  const [defaultPassProtections, setDefaultPassProtections] = useState<Terminology[]>([])
  const [defaultQuickGame, setDefaultQuickGame] = useState<Terminology[]>([])
  const [defaultDropbackGame, setDefaultDropbackGame] = useState<Terminology[]>([])
  const [defaultScreenGame, setDefaultScreenGame] = useState<Terminology[]>([])
  const [defaultShotPlays, setDefaultShotPlays] = useState<Terminology[]>([])
  const [localTerms, setLocalTerms] = useState<TerminologyWithUI[]>(terms || [])
  const [userInfo, setUserInfo] = useState<{id: string | null, email: string | null, team_id: string | null}>({id: null, email: null, team_id: null})
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [hasDeleted, setHasDeleted] = useState(false) // Track if any items have been deleted
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null) // Track success message
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null) // Track timeout for message
  const [showNoMoreItemsMessage, setShowNoMoreItemsMessage] = useState(false)

  // Get user info when component mounts
  useEffect(() => {
    const getUserInfo = async () => {
      try {
        if (!supabase) {
          console.error('Supabase client is not initialized');
          return;
        }
        
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        // Get the user's team_id from profiles table
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('team_id')
          .eq('id', session.user.id)
          .single()
        
        setUserInfo({
          id: session.user.id || null,
          email: session.user.email || null,
          team_id: profileData?.team_id || null
        })
      }
      } catch (error) {
        console.error('Error getting user info:', error);
    }
    }
    
    if (supabase) {
    getUserInfo()
    }
  }, [supabase])

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!supabase) {
          console.error('Supabase client is not initialized');
          return;
        }
        
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
      } catch (error) {
        console.error('Error checking authentication:', error);
    }
    }
    
    if (supabase) {
    checkAuth()
    }
  }, [supabase])

  useEffect(() => {
    if (category === "formations" || category === "form_tags" || category === "shifts" || category === "to_motions" || category === "from_motions" ||
        category === "run_game" || category === "pass_protections" || category === "quick_game" || category === "dropback_game" || 
        category === "screen_game" || category === "shot_plays") {
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
          } else if (category === "shifts") {
            setDefaultShifts(items || []);
          } else if (category === "to_motions") {
            setDefaultToMotions(items || []);
          } else if (category === "from_motions") {
            setDefaultFromMotions(items || []);
          } else if (category === "run_game") {
            setDefaultRunGame(items || []);
          } else if (category === "pass_protections") {
            setDefaultPassProtections(items || []);
          } else if (category === "quick_game") {
            setDefaultQuickGame(items || []);
          } else if (category === "dropback_game") {
            setDefaultDropbackGame(items || []);
          } else if (category === "screen_game") {
            setDefaultScreenGame(items || []);
          } else if (category === "shot_plays") {
            setDefaultShotPlays(items || []);
          }
        } catch (error) {
          console.error(`Error loading team ${category}:`, error);
        }
      };
      
      loadItems();
    }
  }, [category, supabase]);

  // Get available items that haven't been selected yet
  const getAvailableItems = () => {
    try {
    if (category === "formations") {
      const selectedConcepts = localTerms.map(term => term.concept);
      const available = defaultFormations.filter(formation => !selectedConcepts.includes(formation.concept));
      return available;
    } else if (category === "form_tags") {
      const selectedConcepts = localTerms.map(term => term.concept);
      const available = defaultFormTags.filter((tag: Terminology) => !selectedConcepts.includes(tag.concept));
        return available;
      } else if (category === "shifts") {
        const selectedConcepts = localTerms.map(term => term.concept);
        const available = defaultShifts.filter((shift: Terminology) => !selectedConcepts.includes(shift.concept));
        return available;
      } else if (category === "to_motions") {
        const selectedConcepts = localTerms.map(term => term.concept);
        const available = defaultToMotions.filter((motion: Terminology) => !selectedConcepts.includes(motion.concept));
        return available;
      } else if (category === "from_motions") {
        const selectedConcepts = localTerms.map(term => term.concept);
        const available = defaultFromMotions.filter((motion: Terminology) => !selectedConcepts.includes(motion.concept));
        return available;
      } else if (category === "run_game") {
        const selectedConcepts = localTerms.map(term => term.concept);
        const available = defaultRunGame.filter((item: Terminology) => !selectedConcepts.includes(item.concept));
        return available;
      } else if (category === "pass_protections") {
        const selectedConcepts = localTerms.map(term => term.concept);
        const available = defaultPassProtections.filter((item: Terminology) => !selectedConcepts.includes(item.concept));
        return available;
      } else if (category === "quick_game") {
        const selectedConcepts = localTerms.map(term => term.concept);
        const available = defaultQuickGame.filter((item: Terminology) => !selectedConcepts.includes(item.concept));
        return available;
      } else if (category === "dropback_game") {
        const selectedConcepts = localTerms.map(term => term.concept);
        const available = defaultDropbackGame.filter((item: Terminology) => !selectedConcepts.includes(item.concept));
        return available;
      } else if (category === "screen_game") {
        const selectedConcepts = localTerms.map(term => term.concept);
        const available = defaultScreenGame.filter((item: Terminology) => !selectedConcepts.includes(item.concept));
        return available;
      } else if (category === "shot_plays") {
        const selectedConcepts = localTerms.map(term => term.concept);
        const available = defaultShotPlays.filter((item: Terminology) => !selectedConcepts.includes(item.concept));
        return available;
    }
    return [];
    } catch (error) {
      console.error("Error in getAvailableItems:", error);
      return [];
    }
  }

  // Update local terms when props change
  useEffect(() => {
    if (!terms) {
      setLocalTerms([]);
      return;
    }
    
    if (category === "formations" || category === "form_tags" || category === "shifts" || category === "to_motions" || category === "from_motions") {
      const termsWithSelection = terms.map(term => ({
        ...term,
        isSelected: term.team_id === userInfo.team_id
      }));
      setLocalTerms(termsWithSelection);
    } else {
      setLocalTerms(terms);
    }
  }, [terms, category, userInfo.team_id]);

  const addRow = () => {
    if (category === "formations" || category === "form_tags" || category === "shifts" || category === "to_motions" || category === "from_motions" ||
        category === "run_game" || category === "pass_protections" || category === "quick_game" || category === "dropback_game" || 
        category === "screen_game" || category === "shot_plays") {
      const defaultItems = category === "formations" ? defaultFormations : 
                          category === "form_tags" ? defaultFormTags : 
                          category === "shifts" ? defaultShifts :
                          category === "to_motions" ? defaultToMotions :
                          category === "from_motions" ? defaultFromMotions :
                          category === "run_game" ? defaultRunGame :
                          category === "pass_protections" ? defaultPassProtections :
                          category === "quick_game" ? defaultQuickGame :
                          category === "dropback_game" ? defaultDropbackGame :
                          category === "screen_game" ? defaultScreenGame :
                          defaultShotPlays;
      
      if (defaultItems.length === 0) {
        console.log(`No default ${category} available`);
        return; // Don't add if no default items exist at all
      }

      // Find the first unselected item if possible
      const availableItems = getAvailableItems();
      if (availableItems.length === 0) {
        console.log(`No more ${category} available to add`);
        setShowNoMoreItemsMessage(true);
        // Hide the message after 3 seconds
        setTimeout(() => {
          setShowNoMoreItemsMessage(false);
        }, 3000);
        return; // Don't add if no available items
      }

      const itemToUse = availableItems[0];
      
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
    if (category === "formations" || category === "form_tags" || category === "shifts" || category === "to_motions" || category === "from_motions" ||
        category === "run_game" || category === "pass_protections" || category === "quick_game" || category === "dropback_game" || 
        category === "screen_game" || category === "shot_plays") {
      const defaultItems = category === "formations" ? defaultFormations : 
                          category === "form_tags" ? defaultFormTags : 
                          category === "shifts" ? defaultShifts :
                          category === "to_motions" ? defaultToMotions :
                          category === "from_motions" ? defaultFromMotions :
                          category === "run_game" ? defaultRunGame :
                          category === "pass_protections" ? defaultPassProtections :
                          category === "quick_game" ? defaultQuickGame :
                          category === "dropback_game" ? defaultDropbackGame :
                          category === "screen_game" ? defaultScreenGame :
                          defaultShotPlays;
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
    setHasDeleted(true)
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
      
      // Check if supabase client is available
      if (!supabase) {
        console.error('Supabase client is not initialized');
        throw new Error('Authentication client is not available');
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
      if (category === "formations" || category === "form_tags" || category === "shifts" || category === "to_motions" || category === "from_motions") {
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

      if (category === "formations" || category === "form_tags" || category === "shifts" || category === "to_motions" || category === "from_motions") {
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
      if (category === "formations" || category === "form_tags" || category === "shifts" || category === "to_motions" || category === "from_motions") {
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
    if (category === "formations" || category === "form_tags" || category === "shifts" || category === "to_motions" || category === "from_motions" ||
        category === "run_game" || category === "pass_protections" || category === "quick_game" || category === "dropback_game" || 
        category === "screen_game" || category === "shot_plays") {
      try {
        console.log(`Force reloading ${category}...`);
        
        // Check if supabase client is available
        if (!supabase) {
          console.error('Supabase client is not initialized');
          return;
        }
        
        // Always use the default team ID
        const DEFAULT_TEAM_ID = '8feef3dc-942f-4bc5-b526-0b39e14cb683';
        console.log(`Using default team ID for ${category}:`, DEFAULT_TEAM_ID);
        
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
        
        console.log(`Force reloaded ${category}:`, items);
        if (category === "formations") {
          setDefaultFormations(items || []);
        } else if (category === "form_tags") {
          setDefaultFormTags(items || []);
        } else if (category === "shifts") {
          setDefaultShifts(items || []);
        } else if (category === "to_motions") {
          setDefaultToMotions(items || []);
        } else if (category === "from_motions") {
          setDefaultFromMotions(items || []);
        } else if (category === "run_game") {
          setDefaultRunGame(items || []);
        } else if (category === "pass_protections") {
          setDefaultPassProtections(items || []);
        } else if (category === "quick_game") {
          setDefaultQuickGame(items || []);
        } else if (category === "dropback_game") {
          setDefaultDropbackGame(items || []);
        } else if (category === "screen_game") {
          setDefaultScreenGame(items || []);
        } else if (category === "shot_plays") {
          setDefaultShotPlays(items || []);
        }
      } catch (error) {
        console.error(`Error force reloading ${category}:`, error);
      }
    }
  };

  // Handle resetting formations to default (deleting user's team formations)
  const handleResetToDefault = async () => {
    if ((category !== "formations" && category !== "form_tags" && category !== "shifts" && category !== "to_motions" && category !== "from_motions" && 
         category !== "run_game" && category !== "pass_protections" && category !== "quick_game" && category !== "dropback_game" && 
         category !== "screen_game" && category !== "shot_plays") || 
        !userInfo.team_id || userInfo.team_id === DEFAULT_TEAM_ID) {
      console.log(`Cannot reset ${category}: not on formations/form_tags/shifts/to_motions/from_motions/run_game/pass_protections/quick_game/dropback_game/screen_game/shot_plays tab, no team id, or already using default team`);
      return;
    }

    try {
      setIsResetting(true);
      console.log(`Resetting ${category} for team`, userInfo.team_id);

      // Check if supabase client is available
      if (!supabase) {
        console.error('Supabase client is not initialized');
        throw new Error('Authentication client is not available');
      }

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
              <span className="block mt-1 italic">Click the edit button to customize names.</span>
            </p>
          )}
          {saveSuccess && (
            <div className="mt-2 text-sm bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded flex items-center">
              <Check className="h-4 w-4 mr-2 text-green-600" />
              {saveSuccess}
            </div>
          )}
        </div>
        <div className="flex space-x-2 items-center">
          {((localTerms?.some && localTerms.some(term => term.isDirty)) || hasDeleted) && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          )}
            <Button
            variant="outline" 
              onClick={addRow}
            disabled={getAvailableItems().length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add {category === "formations" ? "Formation" : 
                 category === "form_tags" ? "Formation Tag" : 
                 category === "shifts" ? "Shift" : 
                 category === "to_motions" ? "To Motion" : 
                 category === "from_motions" ? "From Motion" :
                 category === "run_game" ? "Run Game" :
                 category === "pass_protections" ? "Pass Protection" :
                 category === "quick_game" ? "Quick Game" :
                 category === "dropback_game" ? "Dropback Game" :
                 category === "screen_game" ? "Screen Game" :
                 category === "shot_plays" ? "Shot Play" : ""}
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="grid grid-cols-[2fr_1fr_auto_auto_auto] gap-4 font-medium mb-2 px-2">
            <div>{category === "formations" ? "Formation" : 
                 category === "form_tags" ? "Formation Tag" : 
                 category === "shifts" ? "Shift" : 
                 category === "to_motions" ? "To Motion" : 
                 category === "from_motions" ? "From Motion" :
                 category === "run_game" ? "Run Game" :
                 category === "pass_protections" ? "Pass Protection" :
                 category === "quick_game" ? "Quick Game" :
                 category === "dropback_game" ? "Dropback Game" :
                 category === "screen_game" ? "Screen Game" :
                 category === "shot_plays" ? "Shot Play" : ""}</div>
                <div>Customized Name</div>
            <div></div>
            <div></div>
            <div></div>
            {category === "formations" && <div></div>}
          </div>

          {localTerms && localTerms.map((term) => (
            <div key={`${term.id}-${term.concept}`} className="grid grid-cols-[2fr_auto_1fr_auto_auto] gap-4 items-center py-2 border-b border-gray-100">
              <div className="flex items-center">
                <Select 
                  value={term.concept || ''} 
                  onValueChange={(value) => updateConcept(term, value, true)}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent className="min-w-[280px]">
                    {/* Always add the current concept to ensure it's in the list */}
                    {term.concept && (
                      <SelectItem value={term.concept}>
                        {term.concept}
                      </SelectItem>
                    )}
                    {/* Show all default items with proper disabled states */}
                    {(category === "formations" ? defaultFormations : 
                      category === "form_tags" ? defaultFormTags : 
                      category === "shifts" ? defaultShifts :
                      category === "to_motions" ? defaultToMotions :
                      category === "from_motions" ? defaultFromMotions :
                      category === "run_game" ? defaultRunGame :
                      category === "pass_protections" ? defaultPassProtections :
                      category === "quick_game" ? defaultQuickGame :
                      category === "dropback_game" ? defaultDropbackGame :
                      category === "screen_game" ? defaultScreenGame :
                      defaultShotPlays)
                      .filter(item => item.concept !== term.concept) // Filter out current concept as it's already added above
                      .map(item => {
                        const isAlreadySelected = localTerms.some(t => t.id !== term.id && t.concept === item.concept);
                        return (
                          <SelectItem 
                            key={item.concept} 
                            value={item.concept || ''} 
                            disabled={isAlreadySelected}
                            className={isAlreadySelected ? "text-gray-400" : ""}
                          >
                            {item.concept} {isAlreadySelected ? "(already selected)" : ""}
                          </SelectItem>
                        );
                      })
                    }
                  </SelectContent>
                </Select>
                
                {/* View button - directly next to dropdown without gap - now for all categories */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 p-1"
                  onClick={() => setSelectedImage({url: term.image_url || '', concept: term.concept || ''})}
                >
                  <Eye className={`h-4 w-4 ${term.image_url ? 'text-amber-500' : 'text-gray-400'}`} />
                </Button>
              </div>
              
              {/* Empty div to maintain grid structure when no view button - no longer needed */}
              <div></div>
              
              <div>
                {term.isEditing ? (
                  <Input
                    value={term.label || ''}
                    onChange={(e) => updateLabel(term, e.target.value)}
                    className="h-8"
                  />
                ) : (
                  <span>{term.label}</span>
                )}
              </div>
              
              {/* Edit button */}
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleEdit(term)}
                >
                  <Pencil className="h-4 w-4 text-blue-500" />
                </Button>
              </div>
              
              {/* Delete button */}
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteRow(term)}
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </Button>
              </div>
            </div>
          ))}
                  </div>

        {/* Show a message when there are no more items available */}
        {showNoMoreItemsMessage && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded relative mb-4 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" />
            <span>No more {category} available to add.</span>
                  </div>
        )}
        
        {/* Add image preview dialog - now for all categories */}
        <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
          <DialogContent className="max-w-[75vw] w-full max-h-[98vh]">
            <DialogHeader className="pb-1 text-center">
              <DialogTitle className="text-xl text-center w-full">
                {category === "formations" ? "Formation" : 
                 category === "form_tags" ? "Formation Tag" : 
                 category === "shifts" ? "Shift" : 
                 category === "to_motions" ? "To Motion" : 
                 category === "from_motions" ? "From Motion" :
                 category === "run_game" ? "Run Game" :
                 category === "pass_protections" ? "Pass Protection" :
                 category === "quick_game" ? "Quick Game" :
                 category === "dropback_game" ? "Dropback Game" :
                 category === "screen_game" ? "Screen Game" :
                 category === "shot_plays" ? "Shot Play" : ""}: {selectedImage?.concept}
              </DialogTitle>
            </DialogHeader>
            <div className="flex justify-center items-center p-0 h-full w-full">
              {selectedImage?.url ? (
                <div className="w-full h-full flex justify-center items-center">
                  <img 
                    src={selectedImage.url} 
                    alt={selectedImage.concept} 
                    className="max-h-[95vh] w-auto object-contain"
                    style={{ maxWidth: '100%' }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 h-[95vh] w-full">
                  <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Image Available</h3>
                  <p className="text-gray-500">This formation doesn't have an image associated with it.</p>
                </div>
              )}
            </div>
            <DialogFooter className="pt-1 justify-center">
              <Button variant="secondary" onClick={() => setSelectedImage(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

// Parent component to manage all terminology sets
export default function SetupPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [terminology, setTerminology] = useState<Terminology[]>([])
  const [formationsSet, setFormationsSet] = useState<TerminologyWithUI[]>([])
  const [formTagsSet, setFormTagsSet] = useState<TerminologyWithUI[]>([])
  const [shiftsSet, setShiftsSet] = useState<TerminologyWithUI[]>([])
  const [toMotionsSet, setToMotionsSet] = useState<TerminologyWithUI[]>([])
  const [fromMotionsSet, setFromMotionsSet] = useState<TerminologyWithUI[]>([])
  const [runGameSet, setRunGameSet] = useState<TerminologyWithUI[]>([])
  const [passProtectionsSet, setPassProtectionsSet] = useState<TerminologyWithUI[]>([])
  const [quickGameSet, setQuickGameSet] = useState<TerminologyWithUI[]>([])
  const [dropbackGameSet, setDropbackGameSet] = useState<TerminologyWithUI[]>([])
  const [screenGameSet, setScreenGameSet] = useState<TerminologyWithUI[]>([])
  const [shotPlaysSet, setShotPlaysSet] = useState<TerminologyWithUI[]>([])
  const [profileInfo, setProfileInfo] = useState<{team_id: string | null}>({team_id: null})
  const [teamCode, setTeamCode] = useState<string | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null)

  // Create Supabase client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Load terminology when component mounts
  useEffect(() => {
  const loadTerminology = async () => {
    try {
        setIsLoading(true)
        
        // Get session to check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user?.id) {
          // Get the user's team_id from profiles table
          const { data: profileData } = await supabase
          .from('profiles')
          .select('team_id')
          .eq('id', session.user.id)
          .single()
        
          const teamId = profileData?.team_id || undefined
          
          // Update profile info state
          setProfileInfo({team_id: teamId || null})
          
          // Get team info if user has a team
          if (teamId) {
            const { data: teamData } = await supabase
              .from('teams')
              .select('name, code')
              .eq('id', teamId)
              .single()
              
            if (teamData) {
              setTeamCode(teamData.code)
              setTeamName(teamData.name)
            }
          }
          
          // Load terminology from API
          const data = await getTerminology(teamId)
          setTerminology(data)
          
          // Group terminology by category
          const formations = data.filter(term => term.category === 'formations')
          const formTags = data.filter(term => term.category === 'form_tags')
          const shifts = data.filter(term => term.category === 'shifts')
          const toMotions = data.filter(term => term.category === 'to_motions')
          const fromMotions = data.filter(term => term.category === 'from_motions')
          const runGame = data.filter(term => term.category === 'run_game')
          const passProtections = data.filter(term => term.category === 'pass_protections')
          const quickGame = data.filter(term => term.category === 'quick_game')
          const dropbackGame = data.filter(term => term.category === 'dropback_game')
          const screenGame = data.filter(term => term.category === 'screen_game')
          const shotPlays = data.filter(term => term.category === 'shot_plays')
          
          setFormationsSet(formations as TerminologyWithUI[])
          setFormTagsSet(formTags as TerminologyWithUI[])
          setShiftsSet(shifts as TerminologyWithUI[])
          setToMotionsSet(toMotions as TerminologyWithUI[])
          setFromMotionsSet(fromMotions as TerminologyWithUI[])
          setRunGameSet(runGame as TerminologyWithUI[])
          setPassProtectionsSet(passProtections as TerminologyWithUI[])
          setQuickGameSet(quickGame as TerminologyWithUI[])
          setDropbackGameSet(dropbackGame as TerminologyWithUI[])
          setScreenGameSet(screenGame as TerminologyWithUI[])
          setShotPlaysSet(shotPlays as TerminologyWithUI[])
      }
    } catch (error) {
        console.error('Error loading terminology:', error)
      } finally {
      setIsLoading(false)
    }
  }

    loadTerminology()
  }, [supabase])
  
  // Handle updates to terminology sets
  const handleUpdateFormations = (updatedTerms: TerminologyWithUI[]) => {
    setFormationsSet(updatedTerms)
  }
  
  const handleUpdateFormTags = (updatedTerms: TerminologyWithUI[]) => {
    setFormTagsSet(updatedTerms)
  }
  
  const handleUpdateShifts = (updatedTerms: TerminologyWithUI[]) => {
    setShiftsSet(updatedTerms)
  }
  
  const handleUpdateToMotions = (updatedTerms: TerminologyWithUI[]) => {
    setToMotionsSet(updatedTerms)
  }
  
  const handleUpdateFromMotions = (updatedTerms: TerminologyWithUI[]) => {
    setFromMotionsSet(updatedTerms)
  }
  
  const handleUpdateRunGame = (updatedTerms: TerminologyWithUI[]) => {
    setRunGameSet(updatedTerms)
  }
  
  const handleUpdatePassProtections = (updatedTerms: TerminologyWithUI[]) => {
    setPassProtectionsSet(updatedTerms)
  }
  
  const handleUpdateQuickGame = (updatedTerms: TerminologyWithUI[]) => {
    setQuickGameSet(updatedTerms)
  }
  
  const handleUpdateDropbackGame = (updatedTerms: TerminologyWithUI[]) => {
    setDropbackGameSet(updatedTerms)
  }
  
  const handleUpdateScreenGame = (updatedTerms: TerminologyWithUI[]) => {
    setScreenGameSet(updatedTerms)
  }
  
  const handleUpdateShotPlays = (updatedTerms: TerminologyWithUI[]) => {
    setShotPlaysSet(updatedTerms)
  }
  
  // Render all terminology sets
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Terminology Setup</h1>
      
      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TerminologySet
              title="Formations"
              terms={formationsSet}
              category="formations"
              onUpdate={handleUpdateFormations}
              supabase={supabase}
              setProfileInfo={setProfileInfo}
              setTeamCode={setTeamCode}
              setTeamName={setTeamName}
            />
            <TerminologySet
              title="Formation Tags"
              terms={formTagsSet}
              category="form_tags"
              onUpdate={handleUpdateFormTags}
              supabase={supabase}
              setProfileInfo={setProfileInfo}
              setTeamCode={setTeamCode}
              setTeamName={setTeamName}
            />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TerminologySet
              title="To Motions"
              terms={toMotionsSet}
              category="to_motions"
              onUpdate={handleUpdateToMotions}
            supabase={supabase}
            setProfileInfo={setProfileInfo}
            setTeamCode={setTeamCode}
            setTeamName={setTeamName}
          />
            <TerminologySet
              title="From Motions"
              terms={fromMotionsSet}
              category="from_motions"
              onUpdate={handleUpdateFromMotions}
              supabase={supabase}
              setProfileInfo={setProfileInfo}
              setTeamCode={setTeamCode}
              setTeamName={setTeamName}
            />
      </div>

          <TerminologySet
            title="Shifts"
            terms={shiftsSet}
            category="shifts"
            onUpdate={handleUpdateShifts}
            supabase={supabase}
            setProfileInfo={setProfileInfo}
            setTeamCode={setTeamCode}
            setTeamName={setTeamName}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TerminologySet
              title="Run Game"
              terms={runGameSet}
              category="run_game"
              onUpdate={handleUpdateRunGame}
              supabase={supabase}
              setProfileInfo={setProfileInfo}
              setTeamCode={setTeamCode}
              setTeamName={setTeamName}
            />
            <TerminologySet
              title="Pass Protections"
              terms={passProtectionsSet}
              category="pass_protections"
              onUpdate={handleUpdatePassProtections}
              supabase={supabase}
              setProfileInfo={setProfileInfo}
              setTeamCode={setTeamCode}
              setTeamName={setTeamName}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TerminologySet
              title="Quick Game"
              terms={quickGameSet}
              category="quick_game"
              onUpdate={handleUpdateQuickGame}
              supabase={supabase}
              setProfileInfo={setProfileInfo}
              setTeamCode={setTeamCode}
              setTeamName={setTeamName}
            />
            <TerminologySet
              title="Dropback Game"
              terms={dropbackGameSet}
              category="dropback_game"
              onUpdate={handleUpdateDropbackGame}
              supabase={supabase}
              setProfileInfo={setProfileInfo}
              setTeamCode={setTeamCode}
              setTeamName={setTeamName}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TerminologySet
              title="Screen Game"
              terms={screenGameSet}
              category="screen_game"
              onUpdate={handleUpdateScreenGame}
              supabase={supabase}
              setProfileInfo={setProfileInfo}
              setTeamCode={setTeamCode}
              setTeamName={setTeamName}
            />
            <TerminologySet
              title="Shot Plays"
              terms={shotPlaysSet}
              category="shot_plays"
              onUpdate={handleUpdateShotPlays}
              supabase={supabase}
              setProfileInfo={setProfileInfo}
              setTeamCode={setTeamCode}
              setTeamName={setTeamName}
            />
          </div>
        </div>
      )}
    </div>
  )
}