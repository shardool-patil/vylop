import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Get the username from the URL (e.g., ?googleUsername=shardool)
    const googleUsername = searchParams.get("googleUsername");

    if (googleUsername) {
      // 2. Save it to localStorage so the app knows you are logged in
      localStorage.setItem("username", googleUsername);
      
      // 3. (Optional) You might want to save a flag that it was a google login
      localStorage.setItem("loginType", "google");

      // 4. Redirect the user to the dashboard immediately
      navigate("/dashboard");
    } else {
      // If something failed, send them back to login
      navigate("/");
    }
  }, [searchParams, navigate]);

  return <div className="flex items-center justify-center h-screen">Logging you in...</div>;
};

export default AuthCallback;