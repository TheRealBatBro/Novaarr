// Shapes below mirror Maintainerr's own server entities/contracts as read directly from its
// source (apps/server/src/modules/{collections,rules}/**, packages/contracts) — trimmed to only
// the fields this UI actually surfaces.

export type MaintainerrCollection = {
  id: number;
  title: string;
  isActive: boolean;
  deleteAfterDays: number;
  handledMediaAmount: number;
  mediaCount: number;
};

export type MaintainerrRuleGroup = {
  id: number;
  name: string;
  isActive: boolean;
  libraryId: string;
  ruleHandlerCronSchedule: string | null;
};

export type RuleExecuteStatus = {
  processingQueue: boolean;
  executingRuleGroupId: number | null;
  pendingRuleGroupIds: number[];
  queue: number[];
};

// CollectionMediaWithMetadata (collection_media.entities.ts + hydrated mediaData).
export type MaintainerrMediaItem = {
  id: number;
  mediaServerId: string;
  addDate: string;
  isManual: boolean;
  mediaData?: { title?: string; parentTitle?: string } | null;
};

// Exclusion entity + hydrated mediaData.
export type MaintainerrExclusion = {
  id: number;
  mediaServerId: string;
  type?: string;
  mediaData?: { title?: string; parentTitle?: string } | null;
};

// CollectionLog entity.
export type MaintainerrLogEntry = {
  id: number;
  timestamp: string;
  message: string;
};

// The content/exclusions/logs endpoints are paginated — exact wrapper shape isn't confirmed
// against a live instance, so this unwraps defensively rather than assuming one specific key.
export function unwrapPage<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Record<string, unknown> | null | undefined;
  const candidate = obj?.items ?? obj?.data ?? obj?.results ?? obj?.records;
  return Array.isArray(candidate) ? (candidate as T[]) : [];
}

export function mediaLabel(item: { mediaData?: { title?: string; parentTitle?: string } | null; mediaServerId: string }): string {
  return item.mediaData?.title || item.mediaData?.parentTitle || `Media #${item.mediaServerId}`;
}
