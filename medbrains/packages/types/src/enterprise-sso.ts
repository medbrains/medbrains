// Enterprise SSO (identity providers + AD-group mappings) types — split from index.ts, barrel-re-exported.

// ── Enterprise SSO (identity providers + AD-group mappings) ──
export interface SsoProvider {
  id: string;
  code: string;
  name: string;
  protocol: "oidc" | "saml";
  is_active: boolean;
  discovery_url: string | null;
  metadata_url: string | null;
  client_id: string | null;
  has_client_secret: boolean;
  group_claim: string;
  default_role: string | null;
  jit_enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateSsoProviderRequest {
  code: string;
  name: string;
  protocol: "oidc" | "saml";
  discovery_url?: string;
  metadata_url?: string;
  client_id?: string;
  client_secret?: string;
  group_claim?: string;
  default_role?: string;
  jit_enabled?: boolean;
  is_active?: boolean;
  config?: Record<string, unknown>;
}

export interface UpdateSsoProviderRequest {
  name?: string;
  discovery_url?: string;
  metadata_url?: string;
  client_id?: string;
  client_secret?: string;
  group_claim?: string;
  default_role?: string;
  jit_enabled?: boolean;
  is_active?: boolean;
  config?: Record<string, unknown>;
}

export interface SsoGroupMapping {
  id: string;
  provider_id: string;
  idp_group: string;
  role_code: string | null;
  access_group_id: string | null;
  created_at: string;
}

/** Non-sensitive provider info for the login page (pre-auth). */
export interface SsoPublicProvider {
  id: string;
  name: string;
  protocol: "oidc" | "saml";
}

export interface CreateSsoGroupMappingRequest {
  idp_group: string;
  role_code?: string;
  access_group_id?: string;
}

export interface NewsFeedArticle {
  id: string;
  topic: string;
  source: string;
  title: string;
  summary: string | null;
  content: string | null;
  url: string;
  image_url: string | null;
  author: string | null;
  published_at: string | null;
}

/** List row — omits `content` (the reader fetches the full article by id). */
export interface NewsFeedListItem {
  id: string;
  topic: string;
  source: string;
  title: string;
  summary: string | null;
  url: string;
  image_url: string | null;
  author: string | null;
  published_at: string | null;
}

export interface IssueTokenInput {
  module: string;
  scope?: string;
  scope_id?: string;
  scope_label?: string;
  priority?: string;
  patient_id?: string;
  patient_name?: string;
  entity_type?: string;
  entity_id?: string;
}
