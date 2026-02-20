import { useEffect, useState } from "react";
import { getMyDocuments } from "../services/backendApi";

interface InProgressGeneration {
  documentId: string;
  documentName: string;
  runId: string;
  status: "queued" | "running";
}

/**
 * Hook to detect and reconnect to in-progress generations after page reload
 */
export function useGenerationReconnect() {
  const [inProgressGeneration, setInProgressGeneration] = useState<InProgressGeneration | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkForInProgressGenerations = async () => {
      try {
        const documents = await getMyDocuments({ page: 1, pageSize: 50 });
        
        // Find documents with running or queued generations
        for (const doc of documents.items) {
          if (doc.latestVersion?.lastGenerationRun) {
            const run = doc.latestVersion.lastGenerationRun;
            if (run.status === "running" || run.status === "queued") {
              setInProgressGeneration({
                documentId: doc.id,
                documentName: doc.name,
                runId: run.id,
                status: run.status,
              });
              break;
            }
          }
        }
      } catch (error) {
        console.error("Failed to check for in-progress generations:", error);
      } finally {
        setIsChecking(false);
      }
    };

    void checkForInProgressGenerations();
  }, []);

  const dismissInProgressGeneration = () => {
    setInProgressGeneration(null);
  };

  return {
    inProgressGeneration,
    isChecking,
    dismissInProgressGeneration,
  };
}
