export interface ConnectorFetchedDocument {
  externalId: string;
  title: string;
  contentText: string;
  sourceUrl?: string | null;
  mimeType?: string | null;
  owner?: string | null;
  accessScope?: string | null;
  revisionId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ConnectorFetchResult {
  documents: ConnectorFetchedDocument[];
  errors: Array<{
    externalId?: string;
    message: string;
  }>;
}
