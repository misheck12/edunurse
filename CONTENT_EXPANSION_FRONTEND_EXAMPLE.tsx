/**
 * Example Frontend Component for Lesson Content Expansion
 * 
 * This is a reference implementation showing how to integrate
 * the AI content expansion feature into the lesson plan editor.
 */

import React, { useState } from 'react';

interface LessonPresentationRow {
  time: string;
  specificObjective: string;
  content: string;
  educatorActivities: string;
  learnerActivities: string;
  materials: string;
  assessment: string;
}

interface LessonPlan {
  id: string;
  topic: string;
  subtopic?: string;
  programme: string;
  course: string;
  presentationRows: LessonPresentationRow[];
}

interface ContentExpansionResponse {
  expandedContent: string;
  provider: string;
  model: string;
  chunksUsed: number;
}

export function LessonPresentationEditor({ lessonPlan, onUpdate }: {
  lessonPlan: LessonPlan;
  onUpdate: (updatedPlan: LessonPlan) => Promise<void>;
}) {
  const [expandingRows, setExpandingRows] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const expandContent = async (rowIndex: number) => {
    const row = lessonPlan.presentationRows[rowIndex];
    
    // Don't expand if already expanded (content is long)
    if (row.content.length > 200) {
      const confirm = window.confirm(
        'This content appears to already be expanded. Expand again?'
      );
      if (!confirm) return;
    }

    setExpandingRows(prev => new Set(prev).add(rowIndex));
    setError(null);

    try {
      const response = await fetch('/api/generation/expand-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`, // Your auth implementation
        },
        body: JSON.stringify({
          topic: lessonPlan.topic,
          subtopic: lessonPlan.subtopic,
          contentBrief: row.content,
          specificObjective: row.specificObjective,
          programme: lessonPlan.programme,
          course: lessonPlan.course,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to expand content: ${response.statusText}`);
      }

      const result: ContentExpansionResponse = await response.json();

      // Update the lesson plan with expanded content
      const updatedPlan = {
        ...lessonPlan,
        presentationRows: lessonPlan.presentationRows.map((r, i) =>
          i === rowIndex ? { ...r, content: result.expandedContent } : r
        ),
      };

      // Save to backend
      await onUpdate(updatedPlan);

      // Show success notification
      showNotification({
        type: 'success',
        message: `Content expanded using ${result.provider} (${result.model})`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      showNotification({
        type: 'error',
        message: 'Failed to expand content. Please try again.',
      });
    } finally {
      setExpandingRows(prev => {
        const next = new Set(prev);
        next.delete(rowIndex);
        return next;
      });
    }
  };

  const expandAllContent = async () => {
    const confirm = window.confirm(
      `Expand content for all ${lessonPlan.presentationRows.length} rows? This may take a few minutes.`
    );
    if (!confirm) return;

    setError(null);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < lessonPlan.presentationRows.length; i++) {
      try {
        await expandContent(i);
        successCount++;
      } catch {
        failCount++;
      }
    }

    showNotification({
      type: successCount > 0 ? 'success' : 'error',
      message: `Expanded ${successCount} rows. ${failCount} failed.`,
    });
  };

  return (
    <div className="lesson-presentation-editor">
      <div className="editor-header">
        <h2>Lesson Presentation</h2>
        <button
          onClick={expandAllContent}
          className="btn btn-secondary"
          disabled={expandingRows.size > 0}
        >
          {expandingRows.size > 0 ? 'Expanding...' : 'Expand All Content'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <table className="lesson-presentation-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Specific Objective</th>
            <th>Content</th>
            <th>Teacher's Activity</th>
            <th>Student's Activity</th>
            <th>Resources</th>
            <th>Evaluation</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {lessonPlan.presentationRows.map((row, index) => (
            <tr key={index}>
              <td>
                <input
                  type="text"
                  value={row.time}
                  onChange={(e) => updateRow(index, 'time', e.target.value)}
                  className="form-input"
                />
              </td>
              <td>
                <textarea
                  value={row.specificObjective}
                  onChange={(e) => updateRow(index, 'specificObjective', e.target.value)}
                  className="form-textarea"
                  rows={2}
                />
              </td>
              <td className="content-cell">
                <textarea
                  value={row.content}
                  onChange={(e) => updateRow(index, 'content', e.target.value)}
                  className="form-textarea"
                  rows={4}
                  placeholder="Brief content description..."
                />
                <button
                  onClick={() => expandContent(index)}
                  disabled={expandingRows.has(index)}
                  className="btn btn-sm btn-primary expand-btn"
                  title="Expand content with AI-generated detailed notes"
                >
                  {expandingRows.has(index) ? (
                    <>
                      <span className="spinner" />
                      Expanding...
                    </>
                  ) : (
                    <>
                      <span className="icon-sparkles" />
                      Expand Content
                    </>
                  )}
                </button>
              </td>
              <td>
                <textarea
                  value={row.educatorActivities}
                  onChange={(e) => updateRow(index, 'educatorActivities', e.target.value)}
                  className="form-textarea"
                  rows={2}
                />
              </td>
              <td>
                <textarea
                  value={row.learnerActivities}
                  onChange={(e) => updateRow(index, 'learnerActivities', e.target.value)}
                  className="form-textarea"
                  rows={2}
                />
              </td>
              <td>
                <textarea
                  value={row.materials}
                  onChange={(e) => updateRow(index, 'materials', e.target.value)}
                  className="form-textarea"
                  rows={2}
                />
              </td>
              <td>
                <textarea
                  value={row.assessment}
                  onChange={(e) => updateRow(index, 'assessment', e.target.value)}
                  className="form-textarea"
                  rows={2}
                />
              </td>
              <td>
                <button
                  onClick={() => deleteRow(index)}
                  className="btn btn-sm btn-danger"
                  title="Delete row"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={addRow}
        className="btn btn-secondary"
      >
        Add Row
      </button>
    </div>
  );

  function updateRow(index: number, field: keyof LessonPresentationRow, value: string) {
    const updatedPlan = {
      ...lessonPlan,
      presentationRows: lessonPlan.presentationRows.map((r, i) =>
        i === index ? { ...r, [field]: value } : r
      ),
    };
    onUpdate(updatedPlan);
  }

  function deleteRow(index: number) {
    const updatedPlan = {
      ...lessonPlan,
      presentationRows: lessonPlan.presentationRows.filter((_, i) => i !== index),
    };
    onUpdate(updatedPlan);
  }

  function addRow() {
    const updatedPlan = {
      ...lessonPlan,
      presentationRows: [
        ...lessonPlan.presentationRows,
        {
          time: '',
          specificObjective: '',
          content: '',
          educatorActivities: '',
          learnerActivities: '',
          materials: '',
          assessment: '',
        },
      ],
    };
    onUpdate(updatedPlan);
  }
}

// Helper functions (implement based on your app's architecture)
function getAuthToken(): string {
  // Return your authentication token
  return localStorage.getItem('authToken') || '';
}

function showNotification(notification: { type: 'success' | 'error'; message: string }) {
  // Implement your notification system
  console.log(`[${notification.type.toUpperCase()}] ${notification.message}`);
}

/**
 * Example CSS for styling the expand button
 */
const styles = `
.content-cell {
  position: relative;
}

.expand-btn {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 4px 8px;
}

.expand-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.icon-sparkles::before {
  content: "✨";
}

.alert {
  padding: 12px;
  margin-bottom: 16px;
  border-radius: 4px;
}

.alert-error {
  background-color: #fee;
  border: 1px solid #fcc;
  color: #c00;
}

.lesson-presentation-table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
}

.lesson-presentation-table th,
.lesson-presentation-table td {
  border: 1px solid #ddd;
  padding: 8px;
  vertical-align: top;
}

.lesson-presentation-table th {
  background-color: #f5f5f5;
  font-weight: 600;
  text-align: left;
}

.form-textarea {
  width: 100%;
  padding: 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
}

.form-input {
  width: 100%;
  padding: 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #545b62;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
`;
