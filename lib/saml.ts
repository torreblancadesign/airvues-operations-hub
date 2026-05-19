// SAML SSO via Google Workspace.
// Self-hosted, single-tenant (one IdP per env). Config loaded from env vars at module init.
// Uses `samlify` for SP/IdP descriptor + AuthnRequest creation + SAMLResponse validation.
//
// Setup doc: docs/auth-saml-setup.md
import "server-only";

import * as samlify from "samlify";

// samlify requires a schema validator. We use the no-op one because Google's SAML responses
// don't need strict schema validation (signature verification + attribute mapping is what matters).
// For stricter validation use `@authenio/samlify-node-xmllint` (Node-only, requires libxml binary).
samlify.setSchemaValidator({
  validate: async () => "skipped",
});

export type SamlRole = "admin" | "editor" | "viewer";

export type SamlConfig = {
  enabled: boolean;
  spEntityId: string;
  spAcsUrl: string;
  spKey: string;
  spCert: string;
  idpSsoUrl: string;
  idpEntityId: string;
  idpCert: string;
  groupAdmin: string;
  groupEditor: string;
  groupViewer: string;
};

function pemNormalize(cert: string): string {
  // Tolerate env vars where line breaks are encoded as \n or already raw
  return cert.replace(/\\n/g, "\n").trim();
}

function loadConfig(): SamlConfig {
  const enabled = process.env.AUTH_METHOD === "saml";
  if (!enabled) {
    return {
      enabled: false,
      spEntityId: "",
      spAcsUrl: "",
      spKey: "",
      spCert: "",
      idpSsoUrl: "",
      idpEntityId: "",
      idpCert: "",
      groupAdmin: "",
      groupEditor: "",
      groupViewer: "",
    };
  }
  const required = [
    "SAML_SP_ENTITY_ID",
    "SAML_SP_ACS_URL",
    "SAML_SP_KEY",
    "SAML_SP_CERT",
    "SAML_IDP_SSO_URL",
    "SAML_IDP_ENTITY_ID",
    "SAML_IDP_CERT",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`AUTH_METHOD=saml requires env vars: ${missing.join(", ")}. See docs/auth-saml-setup.md.`);
  }
  return {
    enabled: true,
    spEntityId: process.env.SAML_SP_ENTITY_ID!,
    spAcsUrl: process.env.SAML_SP_ACS_URL!,
    spKey: pemNormalize(process.env.SAML_SP_KEY!),
    spCert: pemNormalize(process.env.SAML_SP_CERT!),
    idpSsoUrl: process.env.SAML_IDP_SSO_URL!,
    idpEntityId: process.env.SAML_IDP_ENTITY_ID!,
    idpCert: pemNormalize(process.env.SAML_IDP_CERT!),
    groupAdmin: process.env.SAML_GROUP_ADMIN ?? "airvues-ops-admin@airvues.com",
    groupEditor: process.env.SAML_GROUP_EDITOR ?? "airvues-ops-editor@airvues.com",
    groupViewer: process.env.SAML_GROUP_VIEWER ?? "airvues-ops-viewer@airvues.com",
  };
}

let _config: SamlConfig | null = null;
let _sp: ReturnType<typeof samlify.ServiceProvider> | null = null;
let _idp: ReturnType<typeof samlify.IdentityProvider> | null = null;

function ensureInit(): { config: SamlConfig; sp: ReturnType<typeof samlify.ServiceProvider>; idp: ReturnType<typeof samlify.IdentityProvider> } {
  if (_config && _sp && _idp) return { config: _config, sp: _sp, idp: _idp };
  _config = loadConfig();
  if (!_config.enabled) {
    throw new Error("SAML not enabled. Set AUTH_METHOD=saml + SAML_* env vars.");
  }
  _sp = samlify.ServiceProvider({
    entityID: _config.spEntityId,
    assertionConsumerService: [
      {
        Binding: samlify.Constants.namespace.binding.post,
        Location: _config.spAcsUrl,
      },
    ],
    nameIDFormat: [samlify.Constants.namespace.format.emailAddress],
    signingCert: _config.spCert,
    privateKey: _config.spKey,
    authnRequestsSigned: false, // Google has WantAuthnRequestsSigned="false" in their IdP metadata
    wantAssertionsSigned: true,
    wantMessageSigned: false,
    isAssertionEncrypted: false,
  });
  _idp = samlify.IdentityProvider({
    entityID: _config.idpEntityId,
    singleSignOnService: [
      {
        Binding: samlify.Constants.namespace.binding.redirect,
        Location: _config.idpSsoUrl,
      },
      {
        Binding: samlify.Constants.namespace.binding.post,
        Location: _config.idpSsoUrl,
      },
    ],
    signingCert: _config.idpCert,
    isAssertionEncrypted: false,
  });
  return { config: _config, sp: _sp, idp: _idp };
}

export function isSamlEnabled(): boolean {
  return process.env.AUTH_METHOD === "saml";
}

/**
 * Returns the IdP-initiated SSO URL if configured.
 * Workaround for SP-initiated 403 quirks: instead of generating an AuthnRequest, send
 * the user directly to Google's IdP-initiated SSO endpoint, which posts the SAMLResponse
 * straight to our ACS. Same end result, no AuthnRequest from us.
 *
 * URL pattern: https://accounts.google.com/o/saml2/initsso?idpid={IDPID}&spid={SPID}&forceauthn=false
 */
export function getIdpInitiatedUrl(): string | null {
  return process.env.SAML_IDP_INITIATED_URL ?? null;
}

/** Build a SP-initiated SSO redirect URL — user agent is sent here to start SAML SSO. */
export async function buildLoginRedirect(): Promise<string> {
  const { sp, idp } = ensureInit();
  const { context } = sp.createLoginRequest(idp, "redirect");
  return context;
}

/** Process a SAMLResponse posted to the ACS endpoint. Returns extracted user + role. */
export async function processAcsResponse(formBody: URLSearchParams): Promise<{
  email: string;
  name: string | null;
  role: SamlRole;
  groups: string[];
}> {
  const { config, sp, idp } = ensureInit();
  // samlify expects an Express-like request object with `body` and a `method`
  const req = {
    body: Object.fromEntries(formBody.entries()),
  };
  const parsed = await sp.parseLoginResponse(idp, "post", req);

  // Extract attributes
  const attrs = (parsed.extract.attributes ?? {}) as Record<string, string | string[] | undefined>;
  const email =
    (parsed.extract.nameID as string | undefined) ??
    (typeof attrs.email === "string" ? attrs.email : Array.isArray(attrs.email) ? attrs.email[0] : null);

  if (!email) {
    throw new Error("SAML response missing email / NameID");
  }

  const firstName = typeof attrs.firstName === "string" ? attrs.firstName : Array.isArray(attrs.firstName) ? attrs.firstName[0] : null;
  const lastName = typeof attrs.lastName === "string" ? attrs.lastName : Array.isArray(attrs.lastName) ? attrs.lastName[0] : null;
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || null;

  // Groups attribute may be missing, a single string, or an array
  const rawGroups = attrs.groups ?? attrs.Groups ?? attrs.group;
  const groups: string[] = Array.isArray(rawGroups)
    ? rawGroups
    : typeof rawGroups === "string"
      ? [rawGroups]
      : [];

  // Map group → role (highest wins). If user is in no group, fall back to default role.
  // SAML_DEFAULT_ROLE controls what unrouped users get:
  //   - "admin" / "editor" / "viewer" — anyone who authenticates via SAML gets that role
  //   - "deny" or unset — require group membership (original strict behavior)
  const normalize = (g: string) => g.trim().toLowerCase();
  const groupSet = new Set(groups.map(normalize));
  let role: SamlRole | null = null;
  if (groupSet.has(normalize(config.groupAdmin))) role = "admin";
  else if (groupSet.has(normalize(config.groupEditor))) role = "editor";
  else if (groupSet.has(normalize(config.groupViewer))) role = "viewer";

  if (!role) {
    const defaultRole = (process.env.SAML_DEFAULT_ROLE ?? "deny").toLowerCase();
    if (defaultRole === "admin" || defaultRole === "editor" || defaultRole === "viewer") {
      role = defaultRole as SamlRole;
    } else {
      throw new Error(
        `Access denied for ${email}: not a member of any role group (${config.groupAdmin} / ${config.groupEditor} / ${config.groupViewer}). Groups received: ${groups.join(", ") || "(none)"}. To allow all SAML-authenticated users without group check, set SAML_DEFAULT_ROLE=admin (or editor/viewer).`,
      );
    }
  }

  return { email, name, role, groups };
}

/** Generate the SP metadata XML for upload/configuration in Google Workspace */
export function getSpMetadata(): string {
  const { sp } = ensureInit();
  return sp.getMetadata();
}
