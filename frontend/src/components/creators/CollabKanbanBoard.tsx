import { Plus } from "lucide-react";
import { COLLAB_STAGE_ORDER } from "../../lib/collab-stages";
import type { Collaboration, CollabStage } from "../../lib/types";
import { CollabKanbanCard } from "./CollabKanbanCard";

export function CollabKanbanBoard({
  collaborations,
  onAdvance,
  onAddCard,
  onOpenDetail,
  onRequestApproval,
  compact = false,
}: {
  collaborations: Collaboration[];
  onAdvance: (collabId: number, nextStage: CollabStage) => void;
  onAddCard: (stage: CollabStage) => void;
  onOpenDetail: (collabId: number) => void;
  onRequestApproval: (collab: Collaboration) => void;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLLAB_STAGE_ORDER.map((column, idx) => {
          const columnCollabs = collaborations.filter((c) => c.stage === column.key);
          const isDeadLeads = column.key === "dead_leads";
          const nextColumn = COLLAB_STAGE_ORDER[idx + 1];
          const nextStage = !isDeadLeads && nextColumn && nextColumn.key !== "dead_leads" ? nextColumn.key : null;

          return (
            <div key={column.key} className="w-64 shrink-0">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${column.dotClassName}`} />
                  <h3 className="text-sm font-semibold text-ink">{column.label}</h3>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                    {columnCollabs.length}
                  </span>
                </div>
                {!isDeadLeads && (
                  <button
                    onClick={() => onAddCard(column.key)}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-surface hover:text-brand-600"
                    title="Add collaboration"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {columnCollabs.map((collab) => (
                  <CollabKanbanCard
                    key={collab.id}
                    collab={collab}
                    nextStage={nextStage}
                    onAdvance={onAdvance}
                    onOpenDetail={onOpenDetail}
                    onRequestApproval={onRequestApproval}
                    compact={compact}
                  />
                ))}
                {columnCollabs.length === 0 && (
                  <div className="rounded-md border border-dashed border-gray-200 p-3 text-center text-xs text-gray-300">
                    No collaborations
                  </div>
                )}
                {!isDeadLeads && (
                  <button
                    onClick={() => onAddCard(column.key)}
                    className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-[#e7e5e4] py-1.5 text-[11px] font-medium text-gray-400 hover:border-brand-200 hover:text-brand-600"
                  >
                    <Plus size={12} />
                    Add collaboration here
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        Forward moves open required inputs. Backward moves are always allowed.
        <br />
        Drag horizontally to move or skip stages →
      </p>
    </div>
  );
}
