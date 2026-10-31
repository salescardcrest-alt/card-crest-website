# Sign-up confirmation email

`confirm-signup.html` is the email new members get to confirm their address. Supabase sends it, so it is set in the dashboard:

1. Supabase → Authentication → Emails (Email Templates) → **Confirm signup**.
2. Subject: `Confirm your email to start with Card Crest`
3. Paste the whole of `confirm-signup.html` into the message body and save.

The picture is `assets/email/confirm-email.gif` on the website, so push the site first.
`{{ .ConfirmationURL }}`, `{{ .SiteURL }}` and `{{ .Data.name }}` are filled in by Supabase.

To send these from admin@cardcrest.in instead of Supabase's own address, add the same Hostinger SMTP details under
Authentication → Emails → SMTP Settings (host smtp.hostinger.com, port 465, the mailbox and its password).

## Send the confirmation email from admin@cardcrest.in

The "From" address of the sign-up email is not in the website code. It is set in Supabase:

1. Supabase → **Authentication** → **Emails** → **SMTP Settings** → turn on **Enable custom SMTP**.
2. Fill in:
   - Sender email: `admin@cardcrest.in`
   - Sender name: `Card Crest`
   - Host: `smtp.hostinger.com` (Hostinger Titan mail: `smtp.titan.email`)
   - Port: `465`
   - Username: `admin@cardcrest.in`
   - Password: the mailbox password (Hostinger hPanel → Emails)
3. Save, then sign up with a new email address to test it.

The mailbox `admin@cardcrest.in` must exist in Hostinger. If the mail lands in spam, check that the domain's SPF and DKIM
records for cardcrest.in are on (Hostinger hPanel → Emails → the domain → DNS / Email authentication).
The alert emails (Share & Earn) use their own secrets: `SMTP_USER` should also be `admin@cardcrest.in` (see MARKETPLACE.md).
