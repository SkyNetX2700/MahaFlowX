# MahaFlow Product Record

## Original problem statement
Build MahaFlow as a real responsive Maharashtra public-transport platform for passengers, transport authorities, and protected developers. The requested foundation includes Supabase Auth/Postgres/Storage/Realtime/RLS, Google OAuth, one-time MFB/MFR authority codes, facility-level permissions, CCTV and crowd-management architecture, three dashboards, multilingual English/Hindi/Marathi UI, themes, branding, PWA support, accessibility, and responsive navigation. The attached login image is the visual reference. The user requested Supabase, Turnstile, Google OAuth, and Maps configuration to be connected when credentials were supplied.

## Personas
- Passenger: searches and understands public transport and processed crowd information.
- Authority operator: monitors one assigned facility, cameras, zones, and crowd readings.
- Developer/Super Admin: manages facilities, authority access codes, branding, and platform health.

## Architecture decisions
- React + Tailwind-style CSS frontend with a responsive auth screen and role workspaces.
- FastAPI remains on the existing supervisor-managed port for setup health and server-side Turnstile verification. Legacy Mongo access-code/camera/crowd routes are retired with HTTP 410 and are no longer used by the frontend.
- Supabase browser client is configured through `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`; no service-role key is used in the browser.
- Supabase schema and RLS foundation is maintained in `/app/supabase/schema.sql`.
- Session restoration is centralized in `useAuthSession`; routing waits for Supabase initialization and profile-role resolution before showing auth or workspace views.
- The connected project now uses RLS-protected `mahaflow_profiles`, `mahaflow_access_codes`, `mahaflow_facilities`, `mahaflow_cameras`, `mahaflow_transport_services`, `mahaflow_crowd_readings`, `mahaflow_crowd_predictions`, `mahaflow_saved_routes`, `mahaflow_user_settings`, and `mahaflow_branding_settings` tables.
- Cloudflare Turnstile site key is browser-safe; secret verification is server-only at `/api/security/turnstile/verify`.
- Google OAuth client credentials are intentionally not stored in source or environment files; they belong in Supabase Auth Provider settings.
- Google Maps uses a browser-restricted key through `MapView.jsx`.

## Static core requirements
- Passenger email/password, Google OAuth, forgot password, logout, and persistent sessions.
- Authority signup only through a verified one-time MFB/MFR access code with immutable facility assignment.
- Developer code generation, expiration/disable/usage tracking, authority status management, facilities, branding, and audit logs.
- Authority CCTV metadata management, HLS/WebRTC-ready stream architecture, zones, actual readings, and separate predictions.
- Passenger public transport and processed crowd visibility.
- English/Hindi/Marathi, light/dark/system, mobile drawer/sidebar, loading/error/empty/success states, PWA/accessibility.

## Implemented

### 2026-09-09
- Replaced starter screen with a premium MahaFlow auth experience based on the supplied reference direction.
- Added developer, authority, and passenger workspace navigation and responsive dashboards.
- Added working preview API flows for secure-random access codes, atomic consume/disable, facility data, cameras, and crowd readings.
- Added Supabase schema with UUID tables, relationships, indexes, RLS functions/policies, camera streams, branding, transport, notifications, and logs.
- Added CCTV and crowd-management screens with no fake live imagery.
- Fixed authority handoff, one-time code consumption, mobile navigation drawer, and permissive crowd RLS policies after testing.

### 2026-09-09 integration pass
- Connected supplied Supabase URL/anon key to the Supabase browser client with persistent sessions.
- Connected email/password signup/signin, password reset, and Supabase Google OAuth redirect structure.
- Added Cloudflare Turnstile to the auth flow and server-side Siteverify endpoint.
- Added Google Maps loader with browser-restricted key support.
- Build, backend regression, responsive auth, dark theme, access-code lifecycle, camera CRUD, crowd readings, and mobile drawer tests pass.

### 2026-09-10 authentication and branding fix
- Replaced the temporary letter mark with the user-supplied MahaFlow logo across desktop auth, mobile auth, workspace navigation, session loading, favicon, and page metadata.
- Fixed the password-login runtime crash by capturing form values before asynchronous verification.
- Added a real Supabase session gate with PKCE, persistent-session restoration, token refresh handling, OAuth callback cleanup, profile-role resolution, and logout.
- Removed the client-side role switcher so passengers cannot select Authority or Developer workspaces; developer presentation is restricted to the two verified Supabase emails.
- Added `/app/supabase/migrations/20260910_auth_profile_fix.sql` to backfill and maintain roles in the connected `mahaflow_profiles` table.
- Verified production build, backend regression (4/4), real invalid-credential handling, Google OAuth initiation, desktop/mobile logo rendering, responsive overflow, and mocked persisted-session/logout/mobile drawer behavior.

### 2026-09-10 operational workspaces and live integrations
- Updated the existing Cloudflare Turnstile widget through the official API and allowlisted `mahaflow-prod.preview.emergentagent.com` without removing existing hostnames.
- Applied and verified `/app/supabase/migrations/20260910_auth_profile_fix.sql` and `/app/supabase/migrations/20260911_operational_workspaces.sql` against the live Supabase transaction pooler.
- Added secure profile provisioning, exact developer role enforcement, authority status enforcement, 18 RLS policies, atomic access-code RPCs, realtime crowd publication, and four mapped Maharashtra facilities.
- Rebuilt authority onboarding: “Have an access code” now offers Google or email/password first; authenticated users then verify the one-time code and complete a profile with code-locked state, district, transport type, and facility.
- Completed Passenger pages: live-data Overview, Bus & Rail search/filter/save, Google crowd map, separate readings/predictions, Saved Routes, and Settings.
- Completed Authority pages: live-data Overview, realtime YOLO26n-ready crowd telemetry, multi-camera HLS/WebRTC/RTSP registration with HLS playback, code-locked bus/train registry, Reports, and basic Settings.
- Completed Developer pages: live-data Overview, facility-bound MFB/MFR code creation/blocking, authority status management, facility CRUD with Google Maps, dynamic branding controls, and advanced YOLO worker settings.
- Removed all empty “next in workspace” placeholders and all client-side role switching; every displayed metric comes from Supabase rather than hardcoded preview numbers.
- Retired unsecured Mongo preview CRUD APIs with HTTP 410 and moved all operational frontend reads/writes to Supabase tables/RPCs.
- Added HLS.js and a deterministic non-production role-component test harness. Verification passes: frontend production build, 15/15 role/onboarding tests, backend 4/4 tests, live RLS isolation, access-code RPC rollback test, Google Maps loader HTTP 200, and migration inventory checks.

### 2026-09-10 urgent password, token, and Maps fixes
- Added the missing Supabase recovery completion flow: forgot-password emails now return through `/auth/callback?recovery=1`, recovery sessions route to `/reset-password`, and users can create a 12+ character Supabase password through `updateUser` before signing in again.
- Sent a real recovery email successfully to the supplied confirmed Google-only passenger account.
- Fixed Developer access-code generation UX to wait for facilities, disable during generation, and expose exact RPC errors. Reloaded PostgREST schema cache and corrected function grants so `authenticated` can execute while `anon` cannot.
- Reverified the live developer RPC under developer claims in a rolled-back transaction; a valid MFB/MFR code was generated without persisting test data.
- Fixed Google Maps initialization failure (`window.google.maps.Map is not a constructor`) by replacing the manual script loader with official `@googlemaps/js-api-loader` v2 `importLibrary` handling.
- Added preview-only `/map-health`; Playwright verified `Google Maps connected` with a real rendered `.gm-style`/canvas map.
- Verification passes: frontend 18/18 tests, production build, backend 4/4, live RPC grants, real map rendering, and Supabase recovery request HTTP 200.

## Current limitation
- Turnstile hostname rejection 110200 is resolved. Headless automation still receives Cloudflare challenge error 600010 because its adapter/DNS environment cannot complete the challenge; verify signup once in a normal user browser.
- The supplied confirmed passenger account is Google-OAuth-only. Supabase rejected the supplied password and `auth.users` contains no password credential; use “Forgot password” to create a dedicated Supabase password before password persistence testing.
- Completed Google OAuth callback/session persistence still needs one manual sign-in because automated tests do not have interactive Google credentials.
- The recovery email was sent, but the user must click the real email link once to complete the authenticated `/auth/callback` → `/reset-password` transition; automation cannot access the mailbox token.
- YOLO26n is not connected yet. The real readings/predictions schema, realtime subscription, camera links, and worker settings are ready; no detections or predictions are mocked.
- No production CCTV stream URL was supplied. Authorities can register multiple real HLS/WebRTC/RTSP endpoints; HLS is playable directly, while WebRTC/RTSP requires the authority’s browser-compatible gateway.

## Prioritized backlog
- P0: Complete one manual Google OAuth login/refresh/logout check and set a dedicated Supabase password if password authentication is required for the supplied test account.
- P0: Verify Turnstile signup in a normal browser; automation is blocked by Cloudflare 600010 rather than hostname configuration.
- P1: Connect the user’s YOLO26n worker to authenticated crowd-reading and prediction inserts, then validate realtime updates with real camera frames.
- P1: Connect production WebRTC/RTSP gateways and add stream health webhooks/last-seen updates.
- P1: Complete English/Hindi/Marathi translation catalogs and apply centrally stored branding across the full shell.
- P2: Add Supabase Storage for custom branding assets, audit-log views, PWA manifest/service worker, and route timetable ingestion.

## Next tasks
1. Open the newly sent recovery email, choose a 12+ character MahaFlow password, then sign in once with email/password.
2. Sign in with a protected Developer account and generate one real facility code from Access Codes; the RPC and permissions now pass live database verification.
3. Provide the YOLO26n worker endpoint/auth contract and one real HLS/WebRTC test stream for end-to-end telemetry and playback.
4. Add the production hostname to Cloudflare Turnstile when available.