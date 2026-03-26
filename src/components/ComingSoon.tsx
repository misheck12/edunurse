import React from "react";
import { useNavigate } from "react-router-dom";
import { Clock, ArrowLeft } from "lucide-react";

interface ComingSoonProps {
  feature?: string;
}

const ComingSoon: React.FC<ComingSoonProps> = ({ feature }) => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
          <Clock size={32} className="text-blue-500" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-slate-900">Coming Soon</h2>
        <p className="mb-6 text-sm text-slate-500">
          {feature
            ? `${feature} is currently being developed and will be available soon.`
            : "This feature is currently being developed and will be available soon."}
          {" "}We're focusing on delivering the best lesson planning and assessment
          tools first.
        </p>
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Document Studio
        </button>
      </div>
    </div>
  );
};

export default ComingSoon;
