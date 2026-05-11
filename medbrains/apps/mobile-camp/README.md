# MedBrains Camp

Dedicated mobile app for rural and outreach health camps.

The app intentionally exposes only Camp Mode workflows:

- camp selection and packet download
- offline patient search and patient chart
- registration, screening/vitals, lab sample capture, prescription, referral
- inbound sync through the existing camp API

Run through the root Makefile:

```bash
make camp-mobile
make camp-mobile-ios
make camp-mobile-android
make mobile-camp-typecheck
```
