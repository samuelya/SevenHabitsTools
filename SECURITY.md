# Security policy

Seven Habits Tools is a small personal project maintained by one person. Security reports are welcome and taken seriously.

## Supported versions

Only the latest code on `main`, which is what runs in production, is supported. Fixes are not backported.

## Reporting a vulnerability

**Please do not open a public issue, pull request or discussion for a security problem.**

Report it privately through GitHub's private vulnerability reporting:

1. Go to the repository's **Security** tab.
2. Choose **Report a vulnerability**.

Direct link: <https://github.com/samuelya/SevenHabitsTools/security/advisories/new>

Please include:

- what is affected (web app, API/BFF, infrastructure or CI workflows) and the commit or URL;
- steps to reproduce, or a proof of concept;
- the impact you expect (for example data exposure, account or token access, code execution);
- any suggested fix, if you have one.

## What to expect

- An acknowledgement within **7 days**.
- An initial assessment within **14 days**, telling you whether the report is accepted and roughly when a fix is expected.
- Credit in the published advisory if you want it.

This is a volunteer project, so there is no bug bounty.

## Scope

In scope:

- the web app in `src/web` and the API / backend-for-frontend in `src/api`;
- the production deployment's HTTP security headers and Content Security Policy;
- the infrastructure definitions in `infra/` and the GitHub Actions workflows in `.github/workflows/`.

Out of scope:

- vulnerabilities in third-party services and dependencies themselves (report those upstream; Dependabot alerts are enabled here);
- issues that need a compromised device or browser, or physical access;
- missing hardening with no demonstrated impact, and denial-of-service or volumetric testing against production.

## How your data is handled

The app stores your data in your own browser (IndexedDB), and you back it up with manual export. Optional cloud sync is planned: the app would then store only short-lived access tokens in memory, and the backend-for-frontend would keep the refresh token in an encrypted, `HttpOnly` cookie. See the pinned architecture issue for details.

Please test only against your own data, and don't access other people's data.
