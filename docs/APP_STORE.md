# Getting Contact Sheet onto the App Store

This is the roadmap from today's web app to an app other people can download.
Steps 1–2 are done in code; the rest needs accounts/hardware only you can set up.

## 1. Accounts & sync — ✅ built
- Sign up / sign in with email + password, password reset, sign out.
- Contacts sync between every device you sign in on, and still work offline.
- Each person's contacts are private to them (enforced by the database, not just the app).
- In-app **Delete my account** (Apple requires this for any app with sign-up).
- Signing in is optional — the app is fully usable without an account (Apple prefers this).

**To switch it on:** see "Turn on accounts" in the README (create a free Supabase project,
run `supabase/schema.sql`, paste two values into `js/config.js`).

## 2. Privacy policy — ✅ drafted
`privacy.html` is a starting draft. Fill in the [bracketed] parts and have it reviewed.
Apple requires a privacy policy URL for every app.

## 3. Wrap it as a native iPhone app (next step)
The same code becomes an iPhone app using **Capacitor** (a free tool that puts a web app
inside a native shell). What you'll need:
- **Apple Developer Program** membership — $99/year (developer.apple.com/programs).
- **A Mac with Xcode** to build and upload — or a cloud build service (e.g. Codemagic,
  Ionic Appflow) if you don't have a Mac.

When you're ready, I can add the Capacitor project setup to this repo.

## 4. Things Apple will look for in review
- **"More than a website" (guideline 4.2).** Apps that are just a website in a wrapper get
  rejected. The native version should add phone-only features. The best fit here:
  - **Read contacts straight from the phone** (with permission) instead of exporting a .vcf file.
  - Native **print** and **share** sheets for the PDF.
- **Contacts data rules (5.1.2).** Contacts can only be used for the features the user
  asked for. They can't be sold or shared, and you can't contact the people in them.
  The current design already follows these rules.
- **Account deletion (5.1.1)** — ✅ done.
- **Sign in with Apple (4.8)** — only required if you add Google/Facebook sign-in.
  Email + password alone is fine. Adding Sign in with Apple anyway makes signing up easier.
- **App Privacy "nutrition label"** in App Store Connect: you'll declare *Email address*
  and *Contacts* as collected, linked to the user, used for app functionality only, and
  not used for tracking.

## 5. Before real users arrive
- **Supabase plan:** free projects pause after a week of no activity. For a public app,
  use the Pro plan (about $25/month).
- **Email sending:** Supabase's built-in email only sends a few messages per hour. Connect
  a real email service (e.g. Resend, Postmark, SendGrid) under Authentication → SMTP so
  sign-up and password-reset emails arrive reliably. Turn on email confirmation.
- **Your own web address** (e.g. contactsheet.app) for the web version and privacy policy.
- **Backups:** turn on Supabase's daily backups (included in Pro).
- **Terms of use** page (recommended alongside the privacy policy).

## 6. Optional later
- Android / Google Play — the same Capacitor project builds for Android ($25 one-time fee).
- Paid tier or subscription (Apple takes 15% for small businesses).
- Share a tag/list with another person (e.g. a family contact sheet).
- End-to-end encryption so even the server can't read contacts.
