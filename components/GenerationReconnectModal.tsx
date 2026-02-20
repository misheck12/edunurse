import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, X } from "lucide-react";

interface GenerationReconnectModalProps {
  documentId: string;
  documentName: string;
  status: "queued" | "running";
  onDismiss: () => void;
}

export const GenerationReconnectModal: React.FC<GenerationReconnectModalProps> = ({
  documentId,
  documentName,
  status,
  onDismiss,
}) => {
  const navigate = useNavigate();

  const handleReconnect = () => {
    navigate(`/editor/${documentId}`);
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Generation In Progress
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                You have an ongoing generation
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-slate-700 mb-2">
            <span className="font-medium">Document:</span> {documentName}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium">Status:</span>{" "}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                status === "running"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {status}
            </span>
          </p>
        </div>

        <p className="text-sm text-slate-600 mb-6">
          Your lesson plan is still being generated. Would you like to reconnect and
          view the progress?
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleReconnect}
            className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            View Progress
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2.5 rounded-lg font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Dismiss
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-4 text-center">
          Don't worry - your credits are only used when generation completes successfully
        </p>
      </div>
    </div>
  );
};
