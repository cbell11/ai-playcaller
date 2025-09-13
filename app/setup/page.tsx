
"use client"

import React, { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, Pencil, Check, Trash2, Save, Eye, X, RefreshCw, AlertTriangle, Loader2, Image } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { getTerminology, addTerminology, updateTerminology, batchUpdateTerminology, deleteTerminology, initializeDefaultTerminology, Terminology, testSupabaseConnection, updateFormationConcepts, getDefaultTeamFormations } from "@/lib/terminology"
import { updatePlayPoolTerminology } from "@/lib/playpool"
import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { analyzeAndUpdatePlays } from "@/app/actions/analyze-plays"
import { getScoutingReport } from "@/lib/scouting"

// Helper function to generate a random 6-letter code
const generateJoinCode = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Default team that contains base terminology
const DEFAULT_TEAM_ID = '8feef3dc-942f-4bc5-b526-0b39e14cb683';

// Terminology Saving Loading Modal Component
interface TerminologySavingModalProps {
  isOpen: boolean;
  currentStep: number;
  totalSteps: number;
  currentMessage: string;
}

const TerminologySavingModal: React.FC<TerminologySavingModalProps> = ({ 
  isOpen, 
  currentStep, 
  totalSteps, 
  currentMessage 
}) => {
  const progress = (currentStep / totalSteps) * 100;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-200">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Important: Wait while we save your terminology
          </h3>
          
          {/* Loading spinner */}
          <div className="flex justify-center mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          {/* Current step message */}
          <p className="text-sm text-gray-600 mb-2">
            Step {currentStep} of {totalSteps}
          </p>
          <p className="text-sm font-medium text-gray-800">
            {currentMessage}
          </p>
        </div>
      </div>
    </div>
  );
};

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
  const [expandedImageRow, setExpandedImageRow] = useState<string | null>(null)
  const [showAllImages, setShowAllImages] = useState(false)
  const [isActivelyEditing, setIsActivelyEditing] = useState(false)
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
  const [defaultConceptTags, setDefaultConceptTags] = useState<Terminology[]>([])
  const [defaultRpoTags, setDefaultRpoTags] = useState<Terminology[]>([])
  const [localTerms, setLocalTerms] = useState<TerminologyWithUI[]>(terms || [])
  const [userInfo, setUserInfo] = useState<{id: string | null, email: string | null, team_id: string | null}>({id: null, email: null, team_id: null})
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [hasDeleted, setHasDeleted] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)
  const [showNoMoreItemsMessage, setShowNoMoreItemsMessage] = useState(false)
  const [isCheckingAvailable, setIsCheckingAvailable] = useState(false)
  const [availableCount, setAvailableCount] = useState<number | null>(null)
  const [showAddDropdown, setShowAddDropdown] = useState(false)
  const [availableItems, setAvailableItems] = useState<Terminology[]>([])

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
        category === "screen_game" || category === "shot_plays" || category === "concept_tags" || category === "rpo_tag") {
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
          } else if (category === "concept_tags") {
            setDefaultConceptTags(items || []);
          } else if (category === "rpo_tag") {
            setDefaultRpoTags(items || []);
          }
        } catch (error) {
          console.error(`Error loading team ${category}:`, error);
        }
      };
      
      loadItems();
    }
  }, [category, supabase]);

  // Function to get available items that haven't been selected yet
  const getAvailableItems = async () => {
    try {
      // Get the complete data from the default team for this category
      const { data: defaultItems, error: defaultItemsError } = await supabase
        .from('terminology')
        .select('*')
        .eq('category', category)
        .eq('team_id', DEFAULT_TEAM_ID);
        
      if (defaultItemsError) {
        console.error(`Error fetching default ${category}:`, defaultItemsError);
        return [];
      }
      
      if (!defaultItems || defaultItems.length === 0) {
        console.log(`No default ${category} found`);
        return [];
      }

      // Get currently selected concepts
      const selectedConcepts = localTerms.map(term => term.concept).filter((concept): concept is string => concept !== undefined);
      
      // Filter out already selected items and items without concepts
      const availableItems = defaultItems.filter((item) => 
        item.concept && !selectedConcepts.includes(item.concept)
      ) as Terminology[];
      
      return availableItems;
    } catch (error) {
      console.error(`Error in getAvailableItems for ${category}:`, error);
      return [];
    }
  }

  // Effect to check available items when component mounts and when localTerms changes
  useEffect(() => {
    const checkAvailable = async () => {
      setIsCheckingAvailable(true);
      try {
        const items = await getAvailableItems();
        setAvailableItems(items);
        setAvailableCount(items.length);
      } catch (error) {
        console.error('Error checking available items:', error);
      } finally {
        setIsCheckingAvailable(false);
      }
    };

    checkAvailable();
  }, [localTerms, category]);

  // Modify addRow to handle specific concept selection
  const addRow = async (selectedConcept: string) => {
    try {
      const itemToUse = availableItems.find(item => item.concept === selectedConcept);
      
      if (!itemToUse) {
        console.error('Selected concept not found in available items');
        return;
      }

      // Create base term with required fields
      const baseTerm = {
        id: crypto.randomUUID(),
        category: category,
        is_enabled: true,
        isDirty: true,
        isEditing: false,
        isSelected: true,
      };

      // Add optional fields if they exist
      const newTerm: TerminologyWithUI = {
        ...baseTerm,
        ...itemToUse,  // This will copy all fields from the found item
        concept: selectedConcept,  // Override with the selected concept
      };
      
      setLocalTerms([...localTerms, newTerm])
      onUpdate([...localTerms, newTerm])
      setShowAddDropdown(false) // Close dropdown after selection
    } catch (error) {
      console.error('Error adding new row:', error);
    }
  }

  // Update local terms when props change (but not during active editing)
  useEffect(() => {
    // Don't update if user is actively editing
    if (isActivelyEditing) {
      return;
    }
    
    if (!terms) {
      setLocalTerms([]);
      return;
    }
    
    let processedTerms;
    if (category === "formations" || category === "form_tags" || category === "shifts" || category === "to_motions" || category === "from_motions") {
      processedTerms = terms.map(term => ({
        ...term,
        isSelected: term.team_id === userInfo.team_id
      }));
    } else {
      processedTerms = terms;
    }
    
    // Sort alphabetically on initial load
    const sortedTerms = [...processedTerms].sort((a, b) => {
      const aSort = (a.label || a.concept || '').toLowerCase()
      const bSort = (b.label || b.concept || '').toLowerCase()
      return aSort.localeCompare(bSort)
    });
    
    setLocalTerms(sortedTerms);
  }, [terms, category, userInfo.team_id, isActivelyEditing]);

  const updateConcept = (term: TerminologyWithUI, newConcept: string, isSelected: boolean) => {
    if (category === "formations" || category === "form_tags" || category === "shifts" || category === "to_motions" || category === "from_motions" ||
        category === "run_game" || category === "pass_protections" || category === "quick_game" || category === "dropback_game" || 
        category === "screen_game" || category === "shot_plays" || category === "concept_tags" || category === "rpo_tag") {
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
                          category === "shot_plays" ? defaultShotPlays :
                          category === "concept_tags" ? defaultConceptTags :
                          defaultRpoTags;
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

  // Sort terms alphabetically 
  const sortTermsAlphabetically = () => {
    const sortedTerms = [...localTerms].sort((a, b) => {
      // Sort alphabetically by label (customized name), falling back to concept if no label
      const aSort = (a.label || a.concept || '').toLowerCase()
      const bSort = (b.label || b.concept || '').toLowerCase()
      return aSort.localeCompare(bSort)
    })
    setLocalTerms(sortedTerms)
    onUpdate(sortedTerms)
  }

  // Auto-save when user clicks away from edit mode
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    // Check if click is outside any input field that's in edit mode
    if (!target.closest('input') && localTerms.some(term => term.isEditing)) {
      // Find any terms that are currently being edited
      const editedTerms = localTerms.filter(term => term.isEditing)
      if (editedTerms.length > 0) {
        // Exit edit mode for all edited terms
        const updatedTerms = localTerms.map(t => ({ ...t, isEditing: false }))
        setLocalTerms(updatedTerms)
        onUpdate(updatedTerms)
        
        // Clear active editing state
        setIsActivelyEditing(false)
        
        // Sort alphabetically after editing is complete
        setTimeout(() => {
          sortTermsAlphabetically()
        }, 50)
        
        // Auto-save the section if there are dirty terms
        if (localTerms.some(term => term.isDirty) || hasDeleted) {
          handleSaveAll()
        }
      }
    }
  }

  // Add click outside listener
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [localTerms, hasDeleted])

  const toggleEdit = (term: TerminologyWithUI) => {
    const wasEditing = term.isEditing
    const updatedTerms = localTerms.map(t => t.id === term.id ? { ...t, isEditing: !t.isEditing } : t)
    setLocalTerms(updatedTerms)
    onUpdate(updatedTerms)
    
    // Update active editing state
    const nowEditing = updatedTerms.some(t => t.isEditing)
    setIsActivelyEditing(nowEditing)
    
    // If we just finished editing (was editing and now isn't), sort alphabetically
    if (wasEditing) {
      setTimeout(() => {
        sortTermsAlphabetically()
      }, 50)
    }
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
      if (dirtyTerms.length === 0 && !hasDeleted) {
        console.log(`No changes to save for ${category}`);
        return;
      }

      console.log(`Saving ${category} for team:`, teamIdToUse);
      
      // For all categories, we're going to copy from the default team based on the user's current selection
      
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
          
          // Add image_url for any category if it exists
          if (item.image_url) {
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
          // Return the copied item with UI state, preserving original image_url
          return {
            ...matchingInserted,
            image_url: term.image_url || matchingInserted.image_url, // Preserve original image_url
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
      
      // Force reload after save
      setTimeout(() => {
        forceReloadFormations();
      }, 500);

      // Trigger playpool regeneration after individual section save
      try {
        const currentOpponentId = localStorage.getItem('selectedOpponent');
        if (currentOpponentId) {
          // Dispatch a custom event to notify that terminology was updated
          const event = new CustomEvent('terminologyUpdated', { 
            detail: { category, teamId: teamIdToUse }
          });
          window.dispatchEvent(event);
        }
      } catch (error) {
        console.error('Error triggering playpool update:', error);
        // Don't throw - this shouldn't block the save operation
      }
    } catch (error) {
      console.error('Error in handleSaveAll:', error)
      alert(error instanceof Error ? error.message : 'An error occurred while saving')
    } finally {
      setIsSaving(false)
    }
  }

  const forceReloadFormations = async () => {
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
      } else if (category === "concept_tags") {
        setDefaultConceptTags(items || []);
      } else if (category === "rpo_tag") {
        setDefaultRpoTags(items || []);
      }
    } catch (error) {
      console.error(`Error force reloading ${category}:`, error);
    }
  };

  // Handle resetting formations to default (deleting user's team formations)
  const handleResetToDefault = async () => {
    if ((category !== "formations" && category !== "form_tags" && category !== "shifts" && category !== "to_motions" && category !== "from_motions" && 
         category !== "run_game" && category !== "pass_protections" && category !== "quick_game" && category !== "dropback_game" && 
         category !== "screen_game" && category !== "shot_plays" && category !== "concept_tags" && category !== "rpo_tag") || 
        !userInfo.team_id || userInfo.team_id === DEFAULT_TEAM_ID) {
      console.log(`Cannot reset ${category}: not on formations/form_tags/shifts/to_motions/from_motions/run_game/pass_protections/quick_game/dropback_game/screen_game/shot_plays/concept_tags/rpo_tag tab, no team id, or already using default team`);
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
    <Card className={category === "to_motions" || category === "from_motions" || category === "shifts" ? "mb-8 w-full" : "mb-8"}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-xl font-bold">{title}</CardTitle>
          <div className="relative">
            <p className="text-sm text-gray-500 mt-1">
            Select the {category === "formations" ? "formations" : 
                       category === "form_tags" ? "formation tags" : 
                       category === "shifts" ? "shifts" : 
                       category === "to_motions" ? "to motions" : 
                       category === "from_motions" ? "from motions" :
                       category === "run_game" ? "run game concepts" :
                       category === "pass_protections" ? "pass protections" :
                       category === "quick_game" ? "quick game concepts" :
                       category === "dropback_game" ? "dropback game concepts" :
                       category === "screen_game" ? "screen game concepts" :
                       category === "shot_plays" ? "shot plays" :
                       category === "concept_tags" ? "concept tags" :
                       category === "rpo_tag" ? "RPO tags" : "items"} you want to use in your playbook. Delete the ones you don't use.
              <span className="block mt-1 italic">Click the edit button to customize names.</span>
            </p>
          {saveSuccess && (
              <div className="absolute top-0 left-0 right-0 z-10 text-sm bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded flex items-center shadow-sm">
              <Check className="h-4 w-4 mr-2 text-green-600" />
              {saveSuccess}
            </div>
          )}
          </div>
        </div>
        <div className="flex space-x-2 items-center">
          <div className="flex flex-col w-full gap-2">
          {isCheckingAvailable ? (
            <Button
              variant="outline"
              disabled
              className="cursor-wait"
            >
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Checking...
            </Button>
          ) : availableCount === 0 ? (
            <Button
              variant="outline"
              disabled
              className="cursor-not-allowed"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
                All Concepts In Use
            </Button>
          ) : (
            <Select
              open={showAddDropdown}
              onOpenChange={setShowAddDropdown}
              onValueChange={(value) => addRow(value)}
            >
              <SelectTrigger className="cursor-pointer">
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
                     category === "shot_plays" ? "Shot Play" :
                     category === "concept_tags" ? "Concept Tag" : ""}
              </SelectTrigger>
              <SelectContent className="max-w-[400px] max-h-[300px] overflow-y-auto">
                {availableItems
                  .sort((a, b) => {
                    const aSort = (a.label || a.concept || '').toLowerCase()
                    const bSort = (b.label || b.concept || '').toLowerCase()
                    return aSort.localeCompare(bSort)
                  })
                  .map((item) => (
                    <SelectItem 
                      key={item.concept || ''} 
                      value={item.concept || ''}
                      className="whitespace-normal break-words min-h-[60px] py-3 leading-relaxed text-xs"
                    >
                      <span className="block text-xs">{item.concept || ''}</span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
            {localTerms?.some(term => term.image_url) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (showAllImages) {
                    setExpandedImageRow(null);
                    setShowAllImages(false);
                  } else {
                    setShowAllImages(true);
                  }
                }}
                className={`cursor-pointer w-full ${showAllImages ? 'bg-amber-400 hover:bg-amber-500 text-[#0B2545]' : 'bg-amber-400 hover:bg-amber-500 text-[#0B2545] font-medium'}`}
              >
                {showAllImages ? "Hide All Images" : "Show All Images"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className={`grid grid-cols-[2fr_2fr_auto_auto_auto] ${category === "to_motions" || category === "from_motions" || category === "shifts" ? "gap-2" : "gap-4"} font-medium mb-2 px-2`}>
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

          {localTerms && localTerms
            .map((term, index) => (
            <React.Fragment key={term.id}>
              <div className={`grid grid-cols-[2fr_auto_2fr_auto_auto] ${category === "to_motions" || category === "from_motions" || category === "shifts" ? "gap-2 gap-x-1" : "gap-4 gap-x-2"} items-center py-2 border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
              <div className="flex items-center">
                <Select 
                  value={term.concept || ''} 
                  onValueChange={(value) => updateConcept(term, value, true)}
                >
                  <SelectTrigger className={category === "to_motions" || category === "from_motions" || category === "shifts" ? "w-[220px] cursor-pointer" : "w-[280px] cursor-pointer"}>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent className={`${category === "to_motions" || category === "from_motions" || category === "shifts" ? "min-w-[220px] max-w-[320px]" : "min-w-[280px] max-w-[400px]"} max-h-[300px] overflow-y-auto`}>
                    {/* Always add the current concept to ensure it's in the list */}
                    {term.concept && (
                      <SelectItem key={`current-${term.concept}`} value={term.concept} className="whitespace-normal break-words min-h-[60px] py-3 leading-relaxed text-xs">
                        <span className="block text-xs">{term.concept}</span>
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
                      category === "shot_plays" ? defaultShotPlays :
                      category === "concept_tags" ? defaultConceptTags :
                      defaultRpoTags)
                      .filter(item => item.concept !== term.concept) // Filter out current concept as it's already added above
                      .sort((a, b) => {
                        // Sort alphabetically by label (customized name), falling back to concept if no label
                        const aSort = (a.label || a.concept || '').toLowerCase()
                        const bSort = (b.label || b.concept || '').toLowerCase()
                        return aSort.localeCompare(bSort)
                      })
                      .map((item, index) => {
                        const isAlreadySelected = localTerms.some(t => t.id !== term.id && t.concept === item.concept);
                        return (
                          <SelectItem 
                            key={`${item.concept}-${index}`} 
                            value={item.concept || ''} 
                            disabled={isAlreadySelected}
                            className={`whitespace-normal break-words min-h-[60px] py-3 leading-relaxed text-xs ${isAlreadySelected ? "text-gray-400" : ""}`}
                          >
                            <span className="block text-xs">
                              {item.concept} {isAlreadySelected ? "(already selected)" : ""}
                            </span>
                          </SelectItem>
                        );
                      })
                    }
                  </SelectContent>
                </Select>
                
                {/* Toggle button for concept image */}
                <Button
                  variant="outline"
                  size="sm"
                  className={`ml-2 text-xs px-2 py-1 h-6 cursor-pointer border ${term.image_url ? (expandedImageRow === term.id ? 'bg-white text-black border-gray-300 hover:bg-gray-50' : 'bg-[#0B2545] text-white border-[#0B2545] hover:bg-[#0B2545]/90') : 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-500'}`}
                  onClick={() => term.image_url ? setExpandedImageRow(expandedImageRow === term.id ? null : term.id) : null}
                  disabled={!term.image_url}
                >
                  Show Concept Image
                </Button>
              </div>
              
              {/* Empty div to maintain grid structure when no view button - no longer needed */}
              <div></div>
              
              <div>
                {term.isEditing ? (
                  <Input
                    value={term.label || ''}
                    onChange={(e) => updateLabel(term, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        // Exit edit mode and auto-save
                        const updatedTerms = localTerms.map(t => ({ ...t, isEditing: false }))
                        setLocalTerms(updatedTerms)
                        onUpdate(updatedTerms)
                        
                        // Clear active editing state
                        setIsActivelyEditing(false)
                        
                        // Sort alphabetically after editing is complete
                        setTimeout(() => {
                          sortTermsAlphabetically()
                        }, 50)
                        
                        // Auto-save if there are changes
                        if (localTerms.some(term => term.isDirty) || hasDeleted) {
                          handleSaveAll()
                        }
                      }
                    }}
                    className={category === "to_motions" || category === "from_motions" || category === "shifts" ? "h-8 w-full max-w-[180px]" : "h-8"}
                    autoFocus
                  />
                ) : (
                  <span className={category === "to_motions" || category === "from_motions" || category === "shifts" ? "truncate block max-w-[180px]" : ""}>{term.label}</span>
                )}
              </div>
              
              {/* Edit button */}
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleEdit(term)}
                  className={category === "to_motions" || category === "from_motions" || category === "shifts" ? "p-0 h-8 w-8 cursor-pointer" : "cursor-pointer"}
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
                  className={category === "to_motions" || category === "from_motions" || category === "shifts" ? "p-0 h-8 w-8 cursor-pointer" : "cursor-pointer"}
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </Button>
              </div>
                  </div>

              {/* Expanded Image Row */}
              {(expandedImageRow === term.id || showAllImages) && (
                <div className={`col-span-full px-4 py-4 border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  {term.image_url ? (
                    <div className="flex justify-center">
                      <img 
                        src={term.image_url} 
                        alt={term.concept || ''} 
                        className="max-w-lg max-h-80 object-contain border border-gray-300 rounded-lg shadow-sm"
                      />
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <div className="flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-100 max-w-md">
                        <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
                        <h4 className="text-sm font-medium text-gray-900 mb-1">No Image Available</h4>
                        <p className="text-xs text-gray-500">This {category === "formations" ? "formation" : "item"} doesn't have an image associated with it.</p>
                      </div>
                  </div>
                )}
              </div>
              )}
            </React.Fragment>
          ))}
              </div>

        {/* Show a message when there are no more items available */}
        {showNoMoreItemsMessage && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded relative mb-4 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" />
            <span>All {category} concepts are in use.</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Parent component to manage all terminology sets
function SetupPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const welcomeMessage = searchParams.get('message')
  
  const [isLoading, setIsLoading] = useState(true)
  const [terminology, setTerminology] = useState<Terminology[]>([])
  const [formationsSet, setFormationsSet] = useState<TerminologyWithUI[]>([])
  const [formTagsSet, setFormTagsSet] = useState<TerminologyWithUI[]>([])
  const [shiftsSet, setShiftsSet] = useState<TerminologyWithUI[]>([])
  const [toMotionsSet, setToMotionsSet] = useState<TerminologyWithUI[]>([])
  const [fromMotionsSet, setFromMotionsSet] = useState<TerminologyWithUI[]>([])
  const [runGameSet, setRunGameSet] = useState<TerminologyWithUI[]>([])
  const [rpoTagsSet, setRpoTagsSet] = useState<TerminologyWithUI[]>([])
  const [passProtectionsSet, setPassProtectionsSet] = useState<TerminologyWithUI[]>([])
  const [quickGameSet, setQuickGameSet] = useState<TerminologyWithUI[]>([])
  const [dropbackGameSet, setDropbackGameSet] = useState<TerminologyWithUI[]>([])
  const [screenGameSet, setScreenGameSet] = useState<TerminologyWithUI[]>([])
  const [shotPlaysSet, setShotPlaysSet] = useState<TerminologyWithUI[]>([])
  const [conceptTagsSet, setConceptTagsSet] = useState<TerminologyWithUI[]>([])
  const [profileInfo, setProfileInfo] = useState<{team_id: string | null}>({team_id: null})
  const [teamCode, setTeamCode] = useState<string | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null)
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [saveAllSuccess, setSaveAllSuccess] = useState<string | null>(null)
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(!!welcomeMessage)
  const [showSavingModal, setShowSavingModal] = useState(false)
  const [savingStep, setSavingStep] = useState(0)
  const [savingMessage, setSavingMessage] = useState('')

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

          // First, get all default team terminology that has image_urls
          const { data: defaultTerminology, error: defaultError } = await supabase
            .from('terminology')
            .select('*')
            .eq('team_id', DEFAULT_TEAM_ID)
            .not('image_url', 'is', null);

          if (defaultError) {
            console.error('Error fetching default terminology:', defaultError);
          }

          // Create a map of concept to image_url from default team
          const defaultImageUrls = new Map();
          defaultTerminology?.forEach(term => {
            if (term.image_url) {
              defaultImageUrls.set(term.concept, term.image_url);
            }
          });
          
          // Load terminology from API
          const data = await getTerminology(teamId)

          // Merge default image_urls with user terminology
          const mergedData = data.map(term => {
            // If this term has a matching concept in default team with an image_url, use that
            const defaultImageUrl = defaultImageUrls.get(term.concept);
            if (defaultImageUrl) {
              return {
                ...term,
                image_url: defaultImageUrl
              };
            }
            return term;
          });

          setTerminology(mergedData)
          
          // Group terminology by category
          const formations = mergedData.filter(term => term.category === 'formations')
          const formTags = mergedData.filter(term => term.category === 'form_tags')
          const shifts = mergedData.filter(term => term.category === 'shifts')
          const toMotions = mergedData.filter(term => term.category === 'to_motions')
          const fromMotions = mergedData.filter(term => term.category === 'from_motions')
          const runGame = mergedData.filter(term => term.category === 'run_game')
          const rpoTags = mergedData.filter(term => term.category === 'rpo_tag')
          const passProtections = mergedData.filter(term => term.category === 'pass_protections')
          const quickGame = mergedData.filter(term => term.category === 'quick_game')
          const dropbackGame = mergedData.filter(term => term.category === 'dropback_game')
          const screenGame = mergedData.filter(term => term.category === 'screen_game')
          const shotPlays = mergedData.filter(term => term.category === 'shot_plays')
          const conceptTags = mergedData.filter(term => term.category === 'concept_tags')
          
          setFormationsSet(formations as TerminologyWithUI[])
          setFormTagsSet(formTags as TerminologyWithUI[])
          setShiftsSet(shifts as TerminologyWithUI[])
          setToMotionsSet(toMotions as TerminologyWithUI[])
          setFromMotionsSet(fromMotions as TerminologyWithUI[])
          setRunGameSet(runGame as TerminologyWithUI[])
          setRpoTagsSet(rpoTags as TerminologyWithUI[])
          setPassProtectionsSet(passProtections as TerminologyWithUI[])
          setQuickGameSet(quickGame as TerminologyWithUI[])
          setDropbackGameSet(dropbackGame as TerminologyWithUI[])
          setScreenGameSet(screenGame as TerminologyWithUI[])
          setShotPlaysSet(shotPlays as TerminologyWithUI[])
          setConceptTagsSet(conceptTags as TerminologyWithUI[])
        }
      } catch (error) {
        console.error('Error loading terminology:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTerminology()
  }, [supabase])

  // Handle navigation save event
  useEffect(() => {
    const handleSaveBeforeNavigation = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const targetUrl = customEvent.detail?.targetUrl;
      if (targetUrl) {
        console.log('Auto-saving terminology before navigation to:', targetUrl)
        try {
          // Show saving modal during navigation save
          setShowSavingModal(true);
          setSavingStep(1);
          setSavingMessage('Saving your concepts...');
          
          // Trigger save all terminology
          await handleSaveAllTerminology()
          
          // Navigate after save completes
          window.location.href = targetUrl
        } catch (error) {
          console.error('Error saving terminology before navigation:', error)
          // Hide modal and navigate anyway to prevent being stuck
          setShowSavingModal(false);
          window.location.href = targetUrl
        }
      }
    }

    // Add event listener
    window.addEventListener('saveTerminologyBeforeNavigation', handleSaveBeforeNavigation)

    // Cleanup
    return () => {
      window.removeEventListener('saveTerminologyBeforeNavigation', handleSaveBeforeNavigation)
    }
  }, [profileInfo.team_id, formationsSet, formTagsSet, shiftsSet, toMotionsSet, fromMotionsSet, runGameSet, rpoTagsSet, passProtectionsSet, quickGameSet, dropbackGameSet, screenGameSet, shotPlaysSet, conceptTagsSet])
  
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
  
  const handleUpdateRpoTags = (updatedTerms: TerminologyWithUI[]) => {
    setRpoTagsSet(updatedTerms)
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
  
  // Add handler for concept tags updates
  const handleUpdateConceptTags = (updatedTerms: TerminologyWithUI[]) => {
    setConceptTagsSet(updatedTerms)
  }
  
  // Handle restoring all terminology to default
  const handleRestoreToDefault = async () => {
    if (!profileInfo.team_id || profileInfo.team_id === DEFAULT_TEAM_ID) {
      console.log("Cannot restore: no team id or already using default team");
      return;
    }

    try {
      setIsRestoring(true);
      console.log("Restoring all terminology for team", profileInfo.team_id);

      // Check if supabase client is available
      if (!supabase) {
        console.error('Supabase client is not initialized');
        throw new Error('Authentication client is not available');
      }

      // Delete all terminology for the user's team
      const { error: deleteError } = await supabase
        .from('terminology')
        .delete()
        .eq('team_id', profileInfo.team_id);

      if (deleteError) {
        console.error("Error deleting terminology:", deleteError);
        throw new Error("Failed to restore terminology: " + deleteError.message);
      }

      // Show success message
      setRestoreSuccess("Successfully restored all terminology to default!");
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setRestoreSuccess(null);
      }, 5000);

      // Reload the page to show default terminology
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error restoring terminology:", error);
      alert(error instanceof Error ? error.message : "An error occurred while restoring terminology");
    } finally {
      setIsRestoring(false);
      setShowRestoreConfirm(false);
    }
  };
  
  // Function to trigger automatic playpool regeneration
  const triggerPlaypoolRegeneration = async () => {
    try {
      setSavingStep(4);
      setSavingMessage('Regenerating your playpool with new terminology...');
      
      // Get current opponent ID
      const currentOpponentId = localStorage.getItem('selectedOpponent');
      
      if (!currentOpponentId || !profileInfo.team_id) {
        console.log('No opponent or team selected, skipping playpool regeneration');
        return;
      }

      // Get scouting report data
      const scoutingResult = await getScoutingReport(profileInfo.team_id, currentOpponentId);
      
      if (scoutingResult.success && scoutingResult.data) {
        const reportData = scoutingResult.data;
        
        // Create scouting report object for AI analysis
        const scoutingReport = {
          team_id: profileInfo.team_id,
          opponent_id: currentOpponentId,
          fronts: reportData.fronts || [],
          coverages: reportData.coverages || [],
          blitzes: reportData.blitzes || [],
          fronts_pct: reportData.fronts_pct || {},
          coverages_pct: reportData.coverages_pct || {},
          blitz_pct: reportData.blitz_pct || {},
          overall_blitz_pct: reportData.overall_blitz_pct || 0,
          motion_percentage: 100,
          notes: '',
          keep_locked_plays: true,
        };

        // Call analyze and update function to regenerate playpool
        const result = await analyzeAndUpdatePlays(scoutingReport);
        
        if (result.success) {
          console.log('Successfully regenerated playpool with new terminology');
        } else {
          console.error('Failed to regenerate playpool:', result.error);
        }
      }
    } catch (error) {
      console.error('Error during playpool regeneration:', error);
      // Don't throw - this shouldn't block the save process
    }
  };

  // Handle saving all terminology categories
  const handleSaveAllTerminology = async () => {
    if (!profileInfo.team_id) {
      console.log("Cannot save: no team id");
      return;
    }

    try {
      setIsSavingAll(true);
      setShowSavingModal(true);
      setSavingStep(1);
      setSavingMessage('Saving your concepts...');
      console.log("Saving all terminology categories for team", profileInfo.team_id);
      
      // Get the current opponent ID from localStorage for playpool reload
      const currentOpponentId = localStorage.getItem('selectedOpponent');

      // Check if supabase client is available
      if (!supabase) {
        console.error('Supabase client is not initialized');
        throw new Error('Authentication client is not available');
      }

      // Define all categories and their corresponding state sets
      const categories = [
        { name: "formations", set: formationsSet, setFunction: setFormationsSet },
        { name: "form_tags", set: formTagsSet, setFunction: setFormTagsSet },
        { name: "shifts", set: shiftsSet, setFunction: setShiftsSet },
        { name: "to_motions", set: toMotionsSet, setFunction: setToMotionsSet },
        { name: "from_motions", set: fromMotionsSet, setFunction: setFromMotionsSet },
        { name: "run_game", set: runGameSet, setFunction: setRunGameSet },
        { name: "pass_protections", set: passProtectionsSet, setFunction: setPassProtectionsSet },
        { name: "quick_game", set: quickGameSet, setFunction: setQuickGameSet },
        { name: "dropback_game", set: dropbackGameSet, setFunction: setDropbackGameSet },
        { name: "screen_game", set: screenGameSet, setFunction: setScreenGameSet },
        { name: "shot_plays", set: shotPlaysSet, setFunction: setShotPlaysSet },
        { name: "concept_tags", set: conceptTagsSet, setFunction: setConceptTagsSet }
      ];

      let totalSaved = 0;
      let processedCategories = 0;

      // Process each category
      for (const category of categories) {
        console.log(`Processing ${category.name}...`);
        
        if (!category.set || category.set.length === 0) {
          console.log(`No items in ${category.name}, skipping`);
          continue;
        }

        // Update progress for each category
        processedCategories++;
        if (processedCategories <= categories.length / 2) {
          setSavingStep(1);
          setSavingMessage('Saving your concepts...');
        } else {
          setSavingStep(2);
          setSavingMessage('Dialing up deep shots...');
        }

        // Get all the concepts the user wants to keep
        const keepConcepts = category.set.map(term => term.concept);
        
        // Get the complete data from the default team
        const { data: defaultItems, error: defaultItemsError } = await supabase
          .from('terminology')
          .select('*')
          .eq('category', category.name)
          .eq('team_id', DEFAULT_TEAM_ID);
          
        if (defaultItemsError) {
          console.error(`Error fetching default ${category.name}:`, defaultItemsError);
          continue;
        }
        
        if (!defaultItems || defaultItems.length === 0) {
          console.error(`No default ${category.name} found to copy from`);
          continue;
        }
        
        // Create new records by copying from default team and changing team_id
        const itemsToSave = defaultItems
          .filter(item => keepConcepts.includes(item.concept))
          .map(item => {
            // Find the matching local term to get any customized label
            const localTerm = category.set.find(term => term.concept === item.concept);
            
            // Only include essential fields that definitely exist in the database
            const saveItem = {
              concept: item.concept,
              // Use the customized label if available, otherwise use the default
              label: localTerm?.label || item.label,
              category: category.name,
              team_id: profileInfo.team_id,
            };
            
            // Add image_url for any category if it exists
            if (item.image_url) {
              return { ...saveItem, image_url: item.image_url };
            }
            
            return saveItem;
          });
          
        // Delete any existing items for this team and category
        const { error: deleteError } = await supabase
          .from('terminology')
          .delete()
          .eq('category', category.name)
          .eq('team_id', profileInfo.team_id);

        if (deleteError) {
          console.error(`Delete error for ${category.name}:`, deleteError);
          continue;
        }

        // Insert the copied items
        const { data: insertedItems, error: insertError } = await supabase
          .from('terminology')
          .insert(itemsToSave)
          .select();

        if (insertError) {
          console.error(`Insert error for ${category.name}:`, insertError);
          continue;
        }
        
        console.log(`Successfully saved ${insertedItems?.length || 0} ${category.name} for team ${profileInfo.team_id}`);
        totalSaved += insertedItems?.length || 0;
        
        // Update local state to reflect the changes
        const updatedTerms = category.set.map(term => {
          // Find the matching item we just copied
          const matchingInserted = insertedItems?.find(f => f.concept === term.concept);
          
          if (matchingInserted) {
            // Return the copied item with UI state, preserving original image_url
            return {
              ...matchingInserted,
              image_url: term.image_url || matchingInserted.image_url, // Preserve original image_url
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
        
        // Update the state for this category
        category.setFunction(updatedTerms);
      }

      // Step 3: Update playpool terminology
      setSavingStep(3);
      setSavingMessage('Generating 90+ yard TD runs...');
      
      try {
        const { updatePlayPoolTerminology } = await import('../../lib/playpool');
        await updatePlayPoolTerminology();
        console.log('Successfully updated existing playpool terminology');
      } catch (error) {
        console.error('Error updating playpool terminology:', error);
        // Don't throw, just log - this is not critical for the save operation
      }

      // Step 4: Regenerate playpool with AI if opponent is selected
      if (currentOpponentId) {
        await triggerPlaypoolRegeneration();
      }

      // Step 5: Complete
      setSavingStep(5);
      setSavingMessage('Complete! Your terminology has been saved.');
      
      // Wait a moment to show completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Show success message and redirect to scouting
      setSavingMessage('Success! Redirecting to scouting...');
      
      // Wait a moment to show the success message, then redirect
      setTimeout(() => {
        router.push('/scouting');
      }, 1500);

    } catch (error) {
      console.error("Error saving all terminology:", error);
      alert(error instanceof Error ? error.message : "An error occurred while saving all terminology");
    } finally {
      setIsSavingAll(false);
      setShowSavingModal(false);
      setSavingStep(0);
      setSavingMessage('');
    }
  };
  
  // Render all terminology sets
  return (
    <div className="container mx-auto py-8">
      {/* Welcome Message */}
      {showWelcomeMessage && welcomeMessage && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg flex items-center justify-between">
          <p className="text-sm font-medium">{welcomeMessage}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowWelcomeMessage(false)}
            className="text-blue-600 hover:text-blue-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Terminology Setup</h1>
        <div className="flex items-center space-x-4">
          {(saveAllSuccess || restoreSuccess) && (
            <div className="mr-4 text-sm bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded flex items-center">
              <Check className="h-4 w-4 mr-2 text-green-600" />
              {saveAllSuccess || restoreSuccess}
            </div>
          )}
          <Button
            variant="default"
            onClick={handleSaveAllTerminology}
            disabled={isSavingAll || !profileInfo.team_id}
            className="bg-[#2ecc71] hover:bg-[#27ae60] text-white cursor-pointer"
          >
            {isSavingAll ? "Saving..." : "Save All Terminology"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowRestoreConfirm(true)}
            disabled={isRestoring || !profileInfo.team_id || profileInfo.team_id === DEFAULT_TEAM_ID}
            className="bg-[#222222] hover:bg-[#333333] text-white cursor-pointer"
          >
            {isRestoring ? "Restoring..." : "Restore to Default Terminology"}
          </Button>
        </div>
      </div>

      {/* Setup Walkthrough Video */}
      <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-blue-900">Setup Walkthrough</h2>
        </div>
        <p className="text-blue-800 mb-4">
          Need Help? Watch this quick walkthrough to learn how to customize your terminology and get the most out of the setup process.
        </p>
        <div className="flex justify-center">
          <iframe
            src="https://www.loom.com/embed/b693685f541044b6b27a00b29843fe94?sid=9eea9e02-6d20-4b30-ae36-169af6fde60d"
            className="rounded-lg"
            width="300"
            height="300"
            frameBorder="0"
            allowFullScreen
            title="Setup Walkthrough"
          />
        </div>
      </div>
      
      <AlertDialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all saved terminology labels and concepts you have edited. 
              All terminology will be restored to the default values. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreToDefault} className="bg-red-600 hover:bg-red-700 cursor-pointer">
              Yes, Restore to Default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main grid */}
          <div className="grid grid-cols-1 min-[1320px]:grid-cols-2 gap-6">
            {/* Left column - Formations */}
            <div className="space-y-6">
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
                title="Shifts"
                terms={shiftsSet}
                category="shifts"
                onUpdate={handleUpdateShifts}
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
                title="Screen Game"
                terms={screenGameSet}
                category="screen_game"
                onUpdate={handleUpdateScreenGame}
                supabase={supabase}
                setProfileInfo={setProfileInfo}
                setTeamCode={setTeamCode}
                setTeamName={setTeamName}
              />
            </div>

            {/* Right column - Formation Tags, Motions, Run Game, Dropback, and Shot Plays */}
            <div className="space-y-6">
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
                title="RPO Tags"
                terms={rpoTagsSet}
                category="rpo_tag"
                onUpdate={handleUpdateRpoTags}
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
              <TerminologySet
                title="Concept Tags"
                terms={conceptTagsSet}
                category="concept_tags"
                onUpdate={handleUpdateConceptTags}
                supabase={supabase}
                setProfileInfo={setProfileInfo}
                setTeamCode={setTeamCode}
                setTeamName={setTeamName}
              />
            </div>
          </div>
        </div>
      )}

      {/* Terminology Saving Modal */}
      <TerminologySavingModal 
        isOpen={showSavingModal}
        currentStep={savingStep}
        totalSteps={5}
        currentMessage={savingMessage}
      />
    </div>
  )
}

// Export wrapped component with Suspense
export default function SetupPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-8">Loading...</div>}>
      <SetupPageContent />
    </Suspense>
  )
}