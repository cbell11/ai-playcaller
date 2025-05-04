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
  const router = useRouter();

  // Create Supabase client in the browser
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
      
      // Force a page reload to the setup page instead of using router.push
      window.location.href = "/setup";
    } catch (error: any) {
      setError(error.message || "An error occurred during sign in");
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    // First signup step - validate email and password
    if (signupStep === 1) {
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      
      setSignupStep(2);
      return;
    }
    
    // Second signup step - handle team creation or joining
    if (signupStep === 2) {
      if (!teamOption) {
        setError("Please select an option");
        return;
      }
      
      if (teamOption === "create" && !teamName.trim()) {
        setError("Please enter a team name");
        return;
      }
      
      if (teamOption === "join") {
        if (!teamCode || teamCode.length !== 6) {
          setError("Please enter a valid 6-letter team code");
          return;
        }
        
        if (teamCodeValid === false) {
          setError("Invalid team code. Please check and try again.");
          return;
        }
      }
      
      setLoading(true);
      setError("");

      try {
        // Register the user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/setup`
          }
        });
        
        if (authError) throw authError;
        const userId = authData.user?.id;
        
        if (!userId) {
          throw new Error("Failed to create user account");
        }
        
        let teamId: string;
        
        if (teamOption === "create") {
          // Generate a random code for the team
          const joinCode = generateJoinCode();
          
          // Create a new team with timestamp fields and code
          const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .insert([{
              name: teamName,
              code: joinCode,
              created_by: userId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
            .select();
          
          if (teamError) throw teamError;
          
          if (!teamData || teamData.length === 0) {
            throw new Error("Failed to create team");
          }
          
          teamId = teamData[0].id;
          
        } else {
          // Find team by join code
          const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .select('id')
            .eq('code', teamCode.toUpperCase())
            .single();
            
          if (teamError) throw new Error("Invalid team code");
          
          if (!teamData) {
            throw new Error("Team not found");
          }
          
          teamId = teamData.id;
        }
        
        // Create or update the user's profile with the team_id
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            email: email,
            team_id: teamId,
            created_at: new Date().toISOString()
          });
          
        if (profileError) throw profileError;
        
        // Sign in the user immediately after signup
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (signInError) throw signInError;
        
        // Redirect to setup page after successful sign in
        window.location.href = "/setup";
        
      } catch (error: any) {
        setError(error.message || "An error occurred during sign up");
      } finally {
        setLoading(false);
      }
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });

      if (error) throw error;

      setResetEmailSent(true);
      setError("");
    } catch (error: any) {
      setError(error.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  const renderSignupStep1 = () => (
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
      
      <div className="mb-4">
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter your password"
        />
      </div>
      
      <div className="mb-6">
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Confirm your password"
        />
      </div>
    </>
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4" onClick={teamOption === "join" ? handleJoinCodeBoxClick : undefined}>
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-2">AI Playcaller</h1>
          <p className="text-gray-600">Your intelligent football assistant</p>
        </div>
        
        <div className="bg-white p-8 rounded-lg shadow-md">
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
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 flex justify-center items-center"
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
                    className="text-blue-600 text-sm hover:underline"
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
                
                <div className="mb-6">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your password"
                  />
                </div>
                <div className="mb-4 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setError("");
                    }}
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
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 flex justify-center items-center"
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
                className="text-blue-600 text-sm hover:underline"
              >
                {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 