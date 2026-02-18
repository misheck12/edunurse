import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const RequireAdmin: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="text-sm text-slate-500">Checking access...</div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex h-[70vh] items-center justify-center p-4">
        <div className="max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-800">
          <div className="font-semibold flex items-center gap-2 mb-2">
            <ShieldAlert size={18} />
            Superadmin Access Required
          </div>
          <p className="text-sm">
            This page is restricted to superadmin users. Sign in with a
            superadmin account to continue.
          </p>
          <button
            onClick={() => navigate("/ops/login")}
            className="mt-4 px-4 py-2 rounded-lg border border-amber-300 bg-white text-sm hover:bg-amber-100"
          >
            Open Login
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default RequireAdmin;
