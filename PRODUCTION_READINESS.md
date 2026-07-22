# Production Readiness

## What is now covered in the project

- Health endpoint: `/api/health`
- Admin launch-readiness endpoint: `/api/admin/readiness`
- Automatic device lockout and account lockout
- Backup create / restore
- Automatic backup retention cleanup
- Automatic pre-restore backup snapshot
- Mail settings and test mail
- Real-wallet launch configuration

## Final items that still require real external data

- Real SMTP credentials
- Real Google OAuth Client ID
- Real blockchain provider API key
- Real XPUB values for enabled launch networks
- Real bank / PayPal / Wish Money account data
- Real production domain and SSL

## Recommended launch order

1. Set `.env` from `.env.example`
2. Open admin settings and complete:
   - mail settings
   - real-wallet provider settings
   - launch networks
   - deposit verification mode
3. Add active receiving wallets
4. Add real crypto wallet pool or provider XPUB values
5. Review `/api/admin/readiness`
6. Fix every blocking item
7. Create a backup
8. Run production deployment

## Fast checks

- Health:
  - `GET /api/health`
- Launch readiness:
  - `GET /api/admin/readiness`
- Backup list:
  - `GET /api/settings/backups`
