Root cause: the permission values are loading correctly, but `lib/permissions.ts` currently treats auth role `admin` as a bypass for every view permission. Since your SSO user is likely `admin`, the sidebar, Firm Pulse, and Scorecard Admin checks all return true even though People.Permissions only has `Revenue` and `Delivery`.

Plan:
1. Update `lib/permissions.ts` so People.Permissions is the source of truth for view access:
   - `Revenue`, `Delivery`, `Operations` control nav/page groups.
   - `Home - Firm Pulse` controls the Firm Pulse section only.
   - `Scorecard - Admin` controls whether the person picker/all scorecards are visible.
   - Auth role `admin` will no longer bypass these view checks.

2. Keep server-side mutation permissions unchanged:
   - `requireRole(...)`, `canMutate()`, and existing admin/lead edit privileges stay as-is.
   - This only changes what sections/pages are visible and accessible.

3. Preserve dev/testing behavior:
   - The synthetic dev session already has all permissions in `lib/session.ts`, so local/dev bypass still sees everything without needing role-based bypass logic.

4. Verify the affected surfaces:
   - Sidebar/MobileNav should show only Overview + Revenue + Delivery for your current permissions.
   - Home should hide Firm Pulse unless `Home - Firm Pulse` is present.
   - `/me` should resolve directly to your own scorecard and hide the picker unless `Scorecard - Admin` is present.
   - `/team`, `/stack`, `/hygiene` should redirect home without `Operations`.