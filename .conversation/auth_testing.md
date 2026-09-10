# MahaFlow Auth Testing Playbook

1. In Supabase Dashboard, enable Email provider and Google provider, add the app origin to Authentication URL Configuration, and add the Supabase Google callback URI in Google Cloud.
2. Add the current preview hostname to Cloudflare Turnstile allowed hostnames.
3. Test passenger signup with email confirmation, sign in, refresh persistence, password reset, Google sign in, and sign out.
4. In browser storage and network tools, confirm only the Supabase anon key is public; no OAuth secret, Turnstile secret, or service-role key appears.
5. In two accounts, verify that a passenger cannot read authority tables and an authority cannot read another facility.
6. Verify developer RPCs reject non-developer JWTs, authority code consume is atomic, and a second consume returns an error.

Real account passwords must not be stored in this repository. Record only non-secret test identities in `/app/memory/test_credentials.md`.