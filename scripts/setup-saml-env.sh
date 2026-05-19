#!/bin/bash
# Appends SAML config to .env.local. Run from repo root after generating the SP keypair.
# Usage:   ./scripts/setup-saml-env.sh
# Idempotent — won't add duplicate keys; will warn if .env.local already has SAML config.

set -e
cd "$(dirname "$0")/.."

if [ ! -f saml-sp-key.pem ] || [ ! -f saml-sp-cert.pem ]; then
  echo "❌ Missing saml-sp-key.pem or saml-sp-cert.pem in repo root."
  echo "Generate them first:"
  echo '   openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \'
  echo '     -keyout saml-sp-key.pem -out saml-sp-cert.pem \'
  echo '     -subj "/CN=airvues-ops/O=Airvues LLC/C=US"'
  exit 1
fi

if [ ! -f .env.local ]; then
  echo "❌ .env.local not found. Copy .env.local.example first:"
  echo "   cp .env.local.example .env.local"
  exit 1
fi

if grep -q "^SAML_SP_KEY=." .env.local 2>/dev/null; then
  echo "⚠️  .env.local already has SAML_SP_KEY set. Skipping."
  echo "    To replace: remove the existing SAML_* block from .env.local and re-run this."
  exit 0
fi

SP_KEY=$(awk 'BEGIN{ORS="\\n"}1' saml-sp-key.pem)
SP_CERT=$(awk 'BEGIN{ORS="\\n"}1' saml-sp-cert.pem)

# If AUTH_METHOD isn't already set to saml, force it on
if grep -q "^AUTH_METHOD=" .env.local; then
  sed -i.bak 's/^AUTH_METHOD=.*/AUTH_METHOD=saml/' .env.local
  rm -f .env.local.bak
else
  echo "AUTH_METHOD=saml" >> .env.local
fi

# Append the SP keypair (the rest of the SAML config is already populated from .env.local.example)
{
  echo ""
  echo "# SP keypair appended by scripts/setup-saml-env.sh on $(date)"
  echo "SAML_SP_KEY=\"$SP_KEY\""
  echo "SAML_SP_CERT=\"$SP_CERT\""
} >> .env.local

echo "✓ SAML config written to .env.local"
echo ""
echo "Verify the following env vars are also set (should be from .env.local.example):"
echo "  - SAML_IDP_SSO_URL"
echo "  - SAML_IDP_ENTITY_ID"
echo "  - SAML_IDP_CERT"
echo "  - SAML_SP_ENTITY_ID"
echo "  - SAML_SP_ACS_URL"
echo "  - SAML_GROUP_ADMIN / EDITOR / VIEWER"
echo ""
echo "Then restart dev server: npm run dev"
echo "Visit http://localhost:3000/login — should see 'Continue with Google Workspace' button."
