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
  /** A verified email from this provider may find an existing account; never an administrator's. */
  link_by_email: boolean;
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
  link_by_email?: boolean;
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
  link_by_email?: boolean;
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

/** How one hospital lets its staff sign in — asked before signing in. */
export interface SignInOptions {
  /** This install serves one hospital, so the page offers no way to change it. */
  single_hospital: boolean;
  code: string;
  name: string;
  /** Username and password are accepted. */
  password: boolean;
  /** That hospital's own identity providers ("Sign in with Microsoft"). */
  providers: SsoPublicProvider[];
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

/** A person in the hospital's own sign-in service (Kanidm), as the link picker shows them. */
export interface KanidmPerson {
  uuid: string;
  name: string;
  display_name: string | null;
  mail: string | null;
  /** The MedBrains account this person is already linked to, if any. */
  linked_username: string | null;
}

/** A MedBrains account's link to a sign-in person. */
export interface SsoLink {
  provider_id: string;
  subject: string;
}
