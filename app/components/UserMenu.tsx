"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from '@supabase/ssr';
import { User } from "@supabase/supabase-js";

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Create Supabase client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // Fetch user data and team information
    const fetchUserAndTeamInfo = async () => {
      // Get user authentication data
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUser(user);
        
        // Fetch the user's profile data to get team_id and role
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('team_id, role')
          .eq('id', user.id)
          .single();
        
        if (profileData?.role) {
          setUserRole(profileData.role);
        }
        
        if (profileData && !profileError && profileData.team_id) {
          setTeamId(profileData.team_id);
          
          // Fetch team name using the team_id
          const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .select('name')
            .eq('id', profileData.team_id)
            .single();
          
          if (teamData && !teamError) {
            setTeamName(teamData.name);
          }
        }
      }
    };

    fetchUserAndTeamInfo();

    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [supabase.auth]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // Force a page reload to the auth page instead of using router.push
    window.location.href = "/auth";
  };

  if (!user) return null;

  return (
    <div className="flex items-center gap-4">
      {teamName && (
        <div className="font-bold text-gray-800">
          {teamName}
        </div>
      )}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 focus:outline-none cursor-pointer"
          aria-label="User menu"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path 
              fillRule="evenodd" 
              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" 
              clipRule="evenodd" 
            />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border">
            <div className="px-4 py-2 text-sm text-gray-700 border-b">
              {user.email}
            </div>
            {teamName ? (
              <div className="px-4 py-2 text-sm text-gray-700 border-b">
                Team: {teamName}
              </div>
            ) : teamId ? (
              <div className="px-4 py-2 text-sm text-gray-700 border-b">
                Team ID: {teamId}
              </div>
            ) : null}
            {userRole && (
              <div className="px-4 py-2 text-sm text-gray-700 border-b">
                Role: {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
              </div>
            )}
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/account');
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Account
            </button>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 