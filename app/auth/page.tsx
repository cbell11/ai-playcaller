"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from '@supabase/ssr';

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
  const router = useRouter();

  // Create Supabase client in the browser
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
      
      if (teamOption === "join" && !teamCode.trim()) {
        setError("Please enter a team code");
        return;
      }
      
      setLoading(true);
      setError("");

      try {
        // Register the user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (authError) throw authError;
        const userId = authData.user?.id;
        
        if (!userId) {
          throw new Error("Failed to create user account");
        }
        
        if (teamOption === "create") {
          // Create a new team
          const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .insert([{ name: teamName, created_by: userId }])
            .select();
          
          if (teamError) throw teamError;
          
          const teamId = teamData[0]?.id;
          
          // Update user profile with team_id
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ team_id: teamId })
            .eq('id', userId);
            
          if (profileError) throw profileError;
          
        } else if (teamOption === "join") {
          // Find team by join code
          const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .select('id')
            .eq('join_code', teamCode)
            .single();
            
          if (teamError) throw new Error("Invalid team code");
          
          // Update user profile with team_id
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ team_id: teamData.id })
            .eq('id', userId);
            
          if (profileError) throw profileError;
        }
        
        setError("Account created successfully! Check your email for the confirmation link.");
        
        // Reset form and go back to step 1
        setSignupStep(1);
        setTeamOption(null);
        setTeamName("");
        setTeamCode("");
        
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
          <input
            id="teamCode"
            type="text"
            required
            value={teamCode}
            onChange={(e) => setTeamCode(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter team join code"
          />
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-2">AI Playcaller</h1>
          <p className="text-gray-600">Your intelligent football assistant</p>
        </div>
        
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-6">
            {isLogin ? "Sign In" : "Create Account"}
          </h2>
          
          {!isLogin && (
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
          
          <form onSubmit={handleSubmit}>
            {isLogin ? (
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
              </>
            ) : (
              // Render the appropriate signup step
              signupStep === 1 ? renderSignupStep1() : renderSignupStep2()
            )}
            
            <button
              type="submit"
              disabled={loading}
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
          </form>
          
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setSignupStep(1);
                setTeamOption(null);
                setError("");
              }}
              className="text-blue-600 text-sm hover:underline"
            >
              {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 