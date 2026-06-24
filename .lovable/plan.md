## Trim Account detail Overview + reorder sections

In `components/clients/ClientDetailView.tsx`:

**1. Move Contacts above Overview**
Swap the JSX order so the `<Section title="Contacts">` block renders immediately after the header card, before the `<Section title="Overview">`.

**2. Trim Overview fields — keep only these:**
- Industry
- Lead source
- Discount %
- Discount reason
- NDA on file
- Partner status
- Lead status
- Relationship notes
- Business description
- Legal address

**Remove from Overview:**
- Identity group: Client start year, Preferred business
- Commercial group: Contract type, Hourly rate
- Status group: Engagement frequency
- Links group entirely (Website, Drive folder, Miro folder, Google Chat) — these remain accessible via the header action buttons
- Notes group keeps all three (relationship notes, business description, legal address)

**New Overview structure (3 sub-groups):**
- **Identity**: Industry, Lead source
- **Commercial**: Discount %, Discount reason, NDA on file
- **Status**: Partner status, Lead status
- **Notes**: Relationship notes, Business description, Legal address

No data layer, schema, or mutation changes — purely presentational edits in the one component. Header chips, stats, and action buttons are untouched, so removed fields stay editable elsewhere only if they already appear elsewhere (header links cover URLs; hourly rate / contract / engagement / start year / preferred business become read-only from header chips for now).
