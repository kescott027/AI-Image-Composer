import { useMemo, useState } from "react";

import type { RelationPredicate, SceneSpec } from "@ai-image-composer/shared";

import type { RelationConflictRead } from "../api/scenes";
import { addRelationCommand, type SceneCommand, removeRelationCommand } from "../state/commands";

interface RelationsEditorProps {
  sceneSpec: SceneSpec;
  executeCommand: (command: SceneCommand) => void;
  conflicts: RelationConflictRead[];
  conflictMessage: string;
}

const RELATION_OPTIONS: Array<{ value: RelationPredicate; label: string }> = [
  { value: "FACES", label: "faces" },
  { value: "LEFT_OF", label: "left_of" },
  { value: "ABOVE", label: "above" },
  { value: "NEAR", label: "near" },
];

export function RelationsEditor({
  sceneSpec,
  executeCommand,
  conflicts,
  conflictMessage,
}: RelationsEditorProps) {
  const [subjectObjectId, setSubjectObjectId] = useState("");
  const [predicate, setPredicate] = useState<RelationPredicate>("FACES");
  const [objectObjectId, setObjectObjectId] = useState("");

  const objectOptions = useMemo(
    () => sceneSpec.objects.map((object) => ({ id: object.id, name: object.name })),
    [sceneSpec.objects],
  );

  const addRelation = () => {
    if (!subjectObjectId || !objectObjectId || subjectObjectId === objectObjectId) {
      return;
    }
    executeCommand(addRelationCommand(subjectObjectId, predicate, objectObjectId));
  };

  const displayNameById = useMemo(
    () => new Map(sceneSpec.objects.map((object) => [object.id, object.name])),
    [sceneSpec.objects],
  );

  return (
    <section className="relations-editor">
      <h3>Relations</h3>
      <p>Create relation constraints between objects.</p>
      <label className="field-label" htmlFor="relation-subject">
        Subject
      </label>
      <select
        id="relation-subject"
        className="prompt-select"
        value={subjectObjectId}
        onChange={(event) => setSubjectObjectId(event.target.value)}
      >
        <option value="">Select object...</option>
        {objectOptions.map((object) => (
          <option key={object.id} value={object.id}>
            {object.name}
          </option>
        ))}
      </select>

      <label className="field-label" htmlFor="relation-predicate">
        Predicate
      </label>
      <select
        id="relation-predicate"
        className="prompt-select"
        value={predicate}
        onChange={(event) => setPredicate(event.target.value as RelationPredicate)}
      >
        {RELATION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label className="field-label" htmlFor="relation-object">
        Object
      </label>
      <select
        id="relation-object"
        className="prompt-select"
        value={objectObjectId}
        onChange={(event) => setObjectObjectId(event.target.value)}
      >
        <option value="">Select object...</option>
        {objectOptions.map((object) => (
          <option key={object.id} value={object.id}>
            {object.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="button-link"
        onClick={addRelation}
        disabled={!subjectObjectId || !objectObjectId || subjectObjectId === objectObjectId}
      >
        Add Relation
      </button>

      {sceneSpec.relations.length === 0 ? (
        <p className="relation-empty">No relations yet.</p>
      ) : (
        <ul className="relation-list">
          {sceneSpec.relations.map((relation) => (
            <li key={relation.id} className="relation-item">
              <span>
                {(displayNameById.get(relation.subject_object_id) ?? relation.subject_object_id)} {relation.predicate.toLowerCase()} {" "}
                {(displayNameById.get(relation.object_object_id) ?? relation.object_object_id)}
              </span>
              <button
                type="button"
                className="mini-button"
                onClick={() => executeCommand(removeRelationCommand(relation.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relation-conflicts">
        <h4>Constraint Warnings</h4>
        <p className="relation-conflict-message">{conflictMessage}</p>
        {conflicts.length === 0 ? (
          <p className="relation-empty">No directional conflicts detected.</p>
        ) : (
          <ul className="relation-conflict-list">
            {conflicts.map((conflict, index) => (
              <li
                key={`${conflict.conflict_type}-${conflict.relation_ids.join("-")}-${index}`}
                className="relation-conflict-item"
              >
                <p>{conflict.message}</p>
                <p className="relation-conflict-meta">
                  {conflict.conflict_type} on {conflict.relation_ids.join(", ")}
                </p>
                <ul className="relation-conflict-suggestions">
                  {conflict.suggestions.map((suggestion, suggestionIndex) => (
                    <li key={`${conflict.conflict_type}-suggestion-${suggestionIndex}`}>{suggestion}</li>
                  ))}
                </ul>
                <div className="tool-row">
                  <button
                    type="button"
                    className="mini-button"
                    onClick={() => {
                      const relationId = conflict.relation_ids[0];
                      if (relationId) {
                        executeCommand(removeRelationCommand(relationId));
                      }
                    }}
                    disabled={conflict.relation_ids.length === 0}
                  >
                    Remove First Relation
                  </button>
                  <button
                    type="button"
                    className="mini-button"
                    onClick={() => {
                      conflict.relation_ids.forEach((relationId) => {
                        executeCommand(removeRelationCommand(relationId));
                      });
                    }}
                    disabled={conflict.relation_ids.length === 0}
                  >
                    Remove All In Conflict
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
