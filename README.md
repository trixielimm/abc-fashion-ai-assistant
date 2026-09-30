# ABC Fashion AI Stylist

The storefront supports guest stylist searches and optional customer style memory. Signed-in customers can save a preferred name, dress and shoe sizes, likes, avoids, personal style notes, and products. The stylist uses those details for its own recommendations and keeps recent chat turns in the current browser tab. Behaviour-based learning and ordinary site search personalization are not part of this release.

## Run locally

1. Run `npm install` and copy `.env.example` to `.env.local`. Set the Supabase URL and publishable key, plus the server-only `OPENAI_API_KEY`.
2. Apply the Supabase migrations, including `20260928120000_customer_style_memory.sql`, to the development project.
3. Run `npm run dev` and open `http://127.0.0.1:3000`.

The catalogue view must contain product fit and tags for exclusions such as “skinny jeans” to work. An unknown fit on a relevant jeans product is omitted when the customer has saved a skinny-fit exclusion. The current unqualified catalogue size labels are treated as AU; saved sizes in other systems only match explicitly labelled product sizes, and the stylist does not convert between sizing systems. For example, EU 39 shoes can be saved but will have no matches until EU-labelled stock or a verified product-specific size chart is added.

## Authentication setup

This app uses Supabase Auth with Google OAuth and email one-time codes. Add the app's `/auth/callback` URL to Supabase's redirect allow list and configure the Google provider with a Google Cloud OAuth client ID and secret. The Google client must authorize the Supabase callback URL displayed in the provider settings. See the [Supabase Google guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

Email codes require the Magic Link email template to contain `{{ .Token }}`. The local template is in `supabase/templates/sign_in_code.html` and selected in `supabase/config.toml`. For a hosted Supabase project, copy that template into **Authentication → Email Templates → Magic Link**. Configure production SMTP before sending codes to customers; Supabase's default mailer is for development. See the [email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless) and [SMTP](https://supabase.com/docs/guides/auth/auth-smtp) guides.

Google and SMTP credentials belong in Supabase or environment secrets, never in Git. `OPENAI_API_KEY` remains server only. The account-owned tables use row-level security so one customer cannot read or change another customer's style data.

## Checks

Run `npm run lint`, `npx tsc --noEmit`, and `node --import tsx scripts/test-style-memory.ts`. The style-memory test checks saved dress and shoe sizes, a current-request size override, skinny-jeans exclusion and override, and unavailable saved sizes.
