import { useSignIn } from "@clerk/clerk-react";
import { Button } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export const AutoLoginButton = () => {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const handleGuestLogin = async () => {
    if (!isLoaded) return;
    setIsLoading(true);

    try {
      // STEP 1: Start the Login Process (Identify the user)
      const signInAttempt = await signIn.create({
        identifier: "demo@mail.com",
      });

      // STEP 2: Check if it needs a password (It usually does)
      if (signInAttempt.status === "needs_first_factor") {
        
        // STEP 3: Send the Password automatically
        const completeSignIn = await signInAttempt.attemptFirstFactor({
          strategy: "password",
          password: "dem@123!", // The password you set in Dashboard
        });
        // STEP 4: Activate the Session
        if (completeSignIn.status === "complete") {
        await setActive({ session: completeSignIn.createdSessionId });
        navigate("/");
        } else {
        console.error("Login stuck:", completeSignIn);
        }
      } 
      
    } catch (err: any) {
      console.error("Guest login failed:", err.errors ? err.errors[0].message : err);
      alert("Demo Login Failed: " + (err.errors ? err.errors[0].longMessage : "Unknown Error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleGuestLogin}
      disabled={isLoading}
      style={{ color: 'white' }}
    >
      {isLoading ? (
        <span>Logging in...</span> 
      ) : (
        <>
          <span>Sign In (Auto)</span>
        </>
      )}
    </Button>
  );
};