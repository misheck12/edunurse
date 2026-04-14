import React from "react";
import { useNavigate } from "react-router-dom";
import { FileQuestion, ArrowLeft } from "lucide-react";

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <FileQuestion className="mx-auto mb-4 h-16 w-16 text-slate-300" />
        <h1 className="text-2xl font-bold text-slate-800">Page Not Found</h1>
        <p className="mt-2 text-sm text-slate-500">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default NotFound;
