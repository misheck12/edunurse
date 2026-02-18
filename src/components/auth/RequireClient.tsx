import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { clearAuthToken, getAuthToken } from "../../services/backendApi";

const RequireClient: React.FC<{ children: React.ReactElement }> = ({
  children,
}) => {
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const token = getAuthToken();

  if (!token) {
    return (
      <Navigate
        to="/signin"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="text-sm text-slate-500">Checking account...</div>
      </div>
    );
  }

  if (!user) {
    clearAuthToken();
    return <Navigate to="/signin" replace />;
  }

  if (!user.isActive) {
    clearAuthToken();
    return (
      <div className="flex h-[70vh] items-center justify-center p-4">
        <div className="max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-800">
          <p className="text-sm font-semibold">Account Inactive</p>
          <p className="mt-2 text-sm">
            Your account is currently inactive. Contact support to restore
            access.
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default RequireClient;
