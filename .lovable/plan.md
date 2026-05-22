## Plan

1. **Normalize unsafe Airtable text fields in `lib/leads.ts`**
   - Add a small helper that converts Airtable values into safe display strings.
   - Handle normal strings, arrays, and Airtable AI objects like `{ state, value, isStale }` by using the nested `value` text.
   - Fall back to `null` or a readable JSON string only if the value is unexpected.

2. **Apply the helper to lead detail fields**
   - Use it for fields rendered in the lead drawer, especially:
     - `First Name`
     - `Last Name`
     - `What are you looking to build?`
     - `Client Introduction`
     - `Paste Meeting Transcript`
   - This prevents React from trying to render raw objects and causing minified React error #31.

3. **Harden the lead drawer UI in `components/leads/LeadSheet.tsx`**
   - Keep rendering text-only values in the detail fields.
   - Ensure optional fields do not render raw object/array values if Airtable changes shape again.

4. **Verify**
   - Run a TypeScript check for the touched files.
   - If preview auth allows access, click a lead row and confirm the details drawer opens without crashing.