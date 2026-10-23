# Sign-up confirmation email

`confirm-signup.html` is the email new members get to confirm their address. Supabase sends it, so it is set in the dashboard:

1. Supabase → Authentication → Emails (Email Templates) → **Confirm signup**.
2. Subject: `Confirm your email to start with Card Crest`
3. Paste the whole of `confirm-signup.html` into the message body and save.

The picture is `assets/email/confirm-email.gif` on the website, so push the site first.
`{{ .ConfirmationURL }}`, `{{ .SiteURL }}` and `{{ .Data.name }}` are filled in by Supabase.

To send these from admin@cardcrest.in instead of Supabase's own address, add the same Hostinger SMTP details under
Authentication → Emails → SMTP Settings (host smtp.hostinger.com, port 465, the mailbox and its password).
