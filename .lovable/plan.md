# Enable browser autofill on login & signup

Right now the browser doesn't reliably offer saved emails, phones, or passwords because the form inputs are missing the standard hints browsers (Chrome, Safari, Firefox, 1Password, iCloud Keychain) look for.

## What changes

### `src/routes/login.tsx`
- Add `name="email"` to email input (already has `autoComplete="email"`).
- Add `name="password"` to password input (already has `autoComplete="current-password"`).
- Ensure the `<form>` is a real form post target (it is) so password managers detect it.

### `src/routes/signup.tsx`
- Full name: add `name="name"` and `autoComplete="name"`.
- Phone: add `name="tel"`, `autoComplete="tel"`, and `type="tel"`.
- Email: add `name="email"` (already has `autoComplete="email"` and `type="email"`).
- Password: add `name="new-password"` (already has `autoComplete="new-password"`).

## Why this works

Browsers and password managers key off the combination of `autocomplete` + `name` + `type` attributes to:
- Surface saved emails/phones in the dropdown as the user focuses the field.
- Offer to fill the whole form in one click when a matching profile exists.
- Prompt to save credentials after a successful signup/login submit.

## Out of scope

- No changes to validation, submit logic, Supabase auth, or styling.
- No changes to any other forms (those can be done later if needed).