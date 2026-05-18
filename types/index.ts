import type {
  User,
  Organization,
  Membership,
  Workspace,
  Document,
  DocumentChunk,
  DocumentExtraction,
  Insight,
  PainPoint,
  Opportunity,
  PRD,
  EngineeringTicket,
  Conversation,
  Message,
  ProductEvent,
  MembershipRole,
  DocumentSourceType,
  DocumentStatus,
  InsightType,
  PainPointStatus,
  OpportunityStatus,
  TicketPriority,
  MessageRole,
} from "@prisma/client";

export type {
  User,
  Organization,
  Membership,
  Workspace,
  Document,
  DocumentChunk,
  DocumentExtraction,
  Insight,
  PainPoint,
  Opportunity,
  PRD,
  EngineeringTicket,
  Conversation,
  Message,
  ProductEvent,
  MembershipRole,
  DocumentSourceType,
  DocumentStatus,
  InsightType,
  PainPointStatus,
  OpportunityStatus,
  TicketPriority,
  MessageRole,
};

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export const ApiErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  LLM_ERROR: "LLM_ERROR",
  INGESTION_ERROR: "INGESTION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

export function apiError(
  code: string,
  message: string,
  details?: unknown
): ApiError {
  return { ok: false, error: { code, message, details } };
}

// ─── Ingestion Types ──────────────────────────────────────────────────────────

export interface ParsedDocument {
  title?: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface TextChunk {
  index: number;
  content: string;
  tokenCount: number;
}

// ─── Retrieval Types ──────────────────────────────────────────────────────────

export interface RetrievedChunk {
  id: string;
  documentId: string;
  content: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export interface RetrievedContext {
  chunks: RetrievedChunk[];
  insights: Insight[];
  painPoints: PainPoint[];
  opportunities: Opportunity[];
}

// ─── Synthesis Types ──────────────────────────────────────────────────────────

export interface PainPointCluster {
  id: string;
  title: string;
  description: string;
  evidenceQuotes: string[];
  affectedSegments: string[];
  frequency: number;
  avgSeverity: number;
  avgUrgency: number;
  sourceDocumentIds: string[];
}

// ─── Analytics Events ─────────────────────────────────────────────────────────

export type AnalyticsEventName =
  | "document_uploaded"
  | "document_processed"
  | "document_failed"
  | "workspace_synthesized"
  | "opportunities_generated"
  | "prd_generated"
  | "tickets_generated"
  | "chat_message_sent"
  | "opportunity_accepted"
  | "opportunity_rejected";
