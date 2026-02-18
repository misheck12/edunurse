import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { CurrentUserResponse, getCurrentUser } from "../services/backendApi";

interface AuthContextType {
  user: CurrentUserResponse | null;
  isLoading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : "Failed to load current user.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
