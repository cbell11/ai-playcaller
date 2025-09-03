"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from '@supabase/ssr';

// Helper function to generate a random 6-letter code
function generateJoinCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [signupStep, setSignupStep] = useState(1);
  const [teamOption, setTeamOption] = useState<"create" | "join" | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [teamCodeValid, setTeamCodeValid] = useState<boolean | null>(null);
  const [teamCodeValidating, setTeamCodeValidating] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [logoUrl, setLogoUrl] = useState("https://res.cloudinary.com/dfvzvbygc/image/upload/v1756928729/AI_PLAYCALLER_yxbxer.png");
  const router = useRouter();

  // Create Supabase client in the browser
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Check for custom logo URL on mount
  useEffect(() => {
    const customLogoUrl = localStorage.getItem('logoUrl');
    if (customLogoUrl) {
      setLogoUrl(customLogoUrl);
    }
  }, []);

  // Validate team code when it changes and has 6 characters
  useEffect(() => {
    const validateTeamCode = async () => {
      // Only validate if we're at step 2, joining a team, and have a complete code
      if (signupStep !== 2 || teamOption !== "join" || teamCode.length !== 6) {
        setTeamCodeValid(null);
        return;
      }

      setTeamCodeValidating(true);
      console.log("Validating team code:", teamCode);
      
      try {
        // Check if the team code exists in the database
        const { data, error } = await supabase
          .from('teams')
          .select('id')
          .eq('code', teamCode)
          .single();
        
        console.log("Team code validation result:", { data, error });
        setTeamCodeValid(!!data && !error);
      } catch (error) {
        console.error("Error validating team code:", error);
        setTeamCodeValid(false);
      } finally {
        setTeamCodeValidating(false);
      }
    };

    // Debounce the validation to avoid excessive database calls
    const timeoutId = setTimeout(validateTeamCode, 500);
    return () => clearTimeout(timeoutId);
  }, [teamCode, teamOption, signupStep, supabase]);

  const handleTeamCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow uppercase letters
    const newValue = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
    setTeamCode(newValue);
  };

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      // Redirect to scouting page instead of setup
      window.location.href = "/scouting";
    } catch (error: any) {
      setError(error.message || "An error occurred during sign in");
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    try {
      setLoading(true);
      setError("");

      // First validate basic requirements
      if (signupStep === 1) {
        if (password !== confirmPassword) {
          setError("Passwords do not match");
          setLoading(false);
          return;
        }
        
        if (password.length < 6) {
          setError("Password must be at least 6 characters");
          setLoading(false);
          return;
        }
        
        setSignupStep(2);
        setLoading(false);
        return;
      }

      // Validate team-related inputs
      if (!teamOption) {
        setError("Please select an option");
        setLoading(false);
        return;
      }
      
      if (teamOption === "create" && !teamName.trim()) {
        setError("Please enter a team name");
        setLoading(false);
        return;
      }
      
      if (teamOption === "join") {
        if (!teamCode || teamCode.length !== 6) {
          setError("Please enter a valid 6-letter team code");
          setLoading(false);
          return;
        }
        
        if (teamCodeValid === false) {
          setError("Invalid team code. Please check and try again.");
          setLoading(false);
          return;
        }
      }

      // Get or create team_id first
      let teamId: string | undefined;

      // Create the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      });
      
      if (authError) {
        if (authError.message.includes("already registered")) {
          setError("This email is already registered. Please try signing in instead.");
        } else {
          setError(authError.message || "Failed to create user account");
        }
        setLoading(false);
        return;
      }

      if (!authData.user?.id) {
        setError("Failed to create user account");
        setLoading(false);
        return;
      }
      
      const userId = authData.user.id;
      console.log("Created user:", userId);

      // Check if profile already exists
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileCheckError && profileCheckError.code !== 'PGRST116') {
        console.error("Error checking for existing profile:", profileCheckError);
        setError("Error checking user profile status");
        setLoading(false);
        return;
      }

      if (existingProfile) {
        console.log("Found existing profile:", existingProfile);
        // If profile exists but has no team_id, we can update it
        if (!existingProfile.team_id) {
          // Continue with team creation/joining
        } else {
          setError("A profile for this user already exists with a team");
          setLoading(false);
          return;
        }
      }
      
      // If creating a team, do it now
      if (teamOption === "create") {
        const joinCode = generateJoinCode();
        
        const { data: newTeamData, error: teamError } = await supabase
          .from('teams')
          .insert([{
            name: teamName,
            code: joinCode,
            created_by: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select();
        
        if (teamError || !newTeamData || newTeamData.length === 0) {
          console.error("Team creation error:", teamError);
          setError("Failed to create team");
          setLoading(false);
          return;
        }
        
        teamId = newTeamData[0].id;
        console.log("Created new team:", teamId);
      } else if (teamOption === "join") {
        // Find team by join code
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('id')
          .eq('code', teamCode.toUpperCase())
          .single();
          
        if (teamError || !teamData) {
          setError("Invalid team code. Please check and try again.");
          setLoading(false);
          return;
        }
        
        teamId = teamData.id;
        console.log("Found team with code", teamCode, ":", teamId);
      }

      // Verify we have a teamId before proceeding
      if (!teamId) {
        console.error("No team ID available for profile creation");
        setError("Failed to associate user with team");
        setLoading(false);
        return;
      }

      // If profile exists without team_id, update it
      if (existingProfile && !existingProfile.team_id) {
        console.log("Updating existing profile with team_id:", teamId);
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ team_id: teamId })
          .eq('id', userId);

        if (updateError) {
          console.error("Profile update error:", updateError);
          setError("Failed to update profile with team information");
          setLoading(false);
          return;
        }
      } else if (!existingProfile) {
        // Create new profile with the team_id
        console.log("Creating new profile for user", userId, "with team_id:", teamId);
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{
            id: userId,
            email: email,
            team_id: teamId,
            created_at: new Date().toISOString()
          }]);
        
        if (profileError) {
          console.error("Profile creation error:", profileError);
          if (profileError.code === '23505') {
            setError("A profile already exists for this user. Please try signing in.");
          } else {
            setError("Failed to create user profile: " + (profileError.message || "Unknown error"));
          }
          setLoading(false);
          return;
        }
      }

      console.log("Successfully created/updated user and profile. Redirecting to scouting");
      window.location.href = "/scouting";
      
    } catch (error: any) {
      console.error("Signup error:", error);
      setError(error.message || "An error occurred during sign up");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLogin) {
      await handleLogin();
    } else {
      await handleSignup();
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Get the current domain for the redirect URL
      const siteUrl = typeof window !== 'undefined' 
        ? `${window.location.protocol}//${window.location.host}`
        : process.env.NEXT_PUBLIC_SITE_URL || 'https://v0-ai-playcaller.vercel.app';
      
      const redirectUrl = `${siteUrl}/auth/reset-password`;
      
      console.log('Sending password reset to:', email);
      console.log('Redirect URL:', redirectUrl);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      setResetEmailSent(true);
      setError("");
      
      console.log('Password reset email sent successfully');
    } catch (error: any) {
      console.error('Password reset error:', error);
      setError(error.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  const renderSignupStep1 = () => (
    <div>
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          placeholder="Enter your email"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <div className="mb-6">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="confirmPassword">
          Confirm Password
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Confirm your password"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            {showConfirmPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderJoinCodeInput = () => {
    return (
      <div className="flex justify-between mb-2">
        {Array(6).fill(0).map((_, index) => (
          <div 
            key={index} 
            className={`w-12 h-12 border-2 flex items-center justify-center text-xl font-bold rounded ${
              index < teamCode.length 
                ? teamCodeValid === true 
                  ? 'border-green-500 bg-green-50' 
                  : teamCodeValid === false && teamCode.length === 6
                    ? 'border-red-500 bg-red-50'
                    : 'border-blue-500 bg-blue-50'
                : 'border-gray-300'
            }`}
          >
            {teamCode[index] || ''}
          </div>
        ))}
      </div>
    );
  };

  const renderSignupStep2 = () => (
    <>
      <div className="mb-4">
        <div className="text-sm text-gray-700 mb-2">
          Would you like to create a new team or join an existing team?
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            onClick={() => setTeamOption("create")}
            className={`py-3 px-4 rounded-md border ${
              teamOption === "create" 
                ? "border-blue-500 bg-blue-50 text-blue-700" 
                : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            Create a Team
          </button>
          <button
            type="button"
            onClick={() => setTeamOption("join")}
            className={`py-3 px-4 rounded-md border ${
              teamOption === "join" 
                ? "border-blue-500 bg-blue-50 text-blue-700" 
                : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            Join a Team
          </button>
        </div>
      </div>
      
      {teamOption === "create" && (
        <div className="mb-6">
          <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">
            Team Name
          </label>
          <input
            id="teamName"
            type="text"
            required
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your team name"
          />
        </div>
      )}
      
      {teamOption === "join" && (
        <div className="mb-6">
          <label htmlFor="teamCode" className="block text-sm font-medium text-gray-700 mb-1">
            Team Join Code
          </label>
          
          {/* Styled character boxes for join code */}
          {renderJoinCodeInput()}
          
          <input
            id="teamCode"
            type="text"
            required
            value={teamCode}
            onChange={handleTeamCodeChange}
            className="sr-only"
            maxLength={6}
            autoComplete="off"
          />
          
          <div className="mt-3 flex items-center">
            {teamCodeValidating && (
              <div className="text-xs text-blue-600 flex items-center">
                <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                Validating code...
              </div>
            )}
            
            {!teamCodeValidating && teamCode.length === 6 && (
              teamCodeValid ? (
                <div className="text-xs text-green-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Valid team code
                </div>
              ) : (
                <div className="text-xs text-red-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Invalid team code
                </div>
              )
            )}
          </div>
          
          <p className="mt-2 text-xs text-gray-500">
            Enter the 6-letter code provided by your team administrator
          </p>
          
          <div className="mt-3 p-2 bg-blue-50 rounded-md text-xs text-blue-700">
            Tip: Click on the boxes above to focus and type the 6-letter team code
          </div>
        </div>
      )}
      
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setSignupStep(1)}
          className="text-blue-600 text-sm hover:underline"
        >
          &larr; Back to account details
        </button>
      </div>
    </>
  );

  // Add focus handler for the join code input boxes
  const handleJoinCodeBoxClick = () => {
    document.getElementById('teamCode')?.focus();
  };

  // Inside the component, add a function to check database structure
  useEffect(() => {
    // This will run once when the component mounts
    const checkDatabaseStructure = async () => {
      if (process.env.NODE_ENV === 'development') {
        try {
          // Check the structure of the teams table
          const { data, error } = await supabase
            .from('teams')
            .select('*')
            .limit(1);
          
          if (error) {
            console.error('Error fetching teams table structure:', error);
          } else if (data && data.length > 0) {
            console.log('Teams table structure:', Object.keys(data[0]));
            console.log('Sample team record:', data[0]);
          } else {
            console.log('Teams table exists but no records found');
          }
        } catch (err) {
          console.error('Error checking database structure:', err);
        }
      }
    };
    
    checkDatabaseStructure();
  }, [supabase]);

  return (
    <div className="w-full max-w-md px-4" onClick={teamOption === "join" ? handleJoinCodeBoxClick : undefined}>
                  <div className="text-center mb-4">
            <img 
              src={logoUrl} 
              alt="AI Playcaller" 
              className="mx-auto -mt-20 -mb-10 h-90 w-auto"
            />
            <p className="text-gray-600 mb-3 text-sm">Your intelligent football assistant</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              <p className="mb-2">
                <strong>Coaches, welcome!</strong> Every new account starts with a 7-day trial. 
                After that, access continues with a paid subscription.
              </p>
              <a 
                href="https://american-football-academy.com/ai-play-caller-home-page" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
              >
                Subscribe Here
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-6">
            {showForgotPassword ? "Reset Password" : (isLogin ? "Sign In" : "Create Account")}
          </h2>
          
          {!isLogin && !showForgotPassword && (
            <div className="flex mb-6">
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  signupStep >= 1 ? "bg-blue-600 text-white" : "bg-gray-200"
                }`}>
                  1
                </div>
                <div className={`h-1 w-8 ${
                  signupStep > 1 ? "bg-blue-600" : "bg-gray-200"
                }`}></div>
              </div>
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  signupStep >= 2 ? "bg-blue-600 text-white" : "bg-gray-200"
                }`}>
                  2
                </div>
              </div>
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          {resetEmailSent && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">
              Password reset email sent! Please check your inbox.
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            {showForgotPassword ? (
              <>
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your email"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 flex justify-center items-center cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-3"></div>
                      <span>Sending...</span>
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmailSent(false);
                      setError("");
                    }}
                    className="text-blue-600 text-sm hover:underline cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              </>
            ) : isLogin ? (
              <>
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your email"
                  />
                </div>
                
                <div>
                  <label htmlFor="loginPassword" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="loginPassword"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="mb-4 text-right">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
              </>
            ) : (
              // Render the appropriate signup step
              signupStep === 1 ? renderSignupStep1() : renderSignupStep2()
            )}
            
            {!showForgotPassword && (
              <button
                type="submit"
                disabled={loading || (teamOption === "join" && teamCode.length === 6 && teamCodeValid === false)}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 flex justify-center items-center cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-3"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  isLogin ? "Sign In" : (signupStep === 1 ? "Continue" : "Create Account")
                )}
              </button>
            )}
          </form>
          
          {!showForgotPassword && (
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setSignupStep(1);
                  setTeamOption(null);
                  setTeamName("");
                  setTeamCode("");
                  setTeamCodeValid(null);
                  setError("");
                }}
                className="text-blue-600 text-sm hover:underline cursor-pointer"
              >
                {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          )}
      </div>
    </div>
  );
} 