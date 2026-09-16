# Event Gallery — Requirements & Delivery Plan

## Scope checklist

- [x] JWT registration, login, profile, and password hashing
- [x] Role-based access for admins and assigned team members
- [x] Event creation, member assignment, scoped event retrieval
- [x] Cloudinary-backed multipart photo uploads with failure safety
- [x] Admin photo review, PIN-hashed gallery creation, publishing
- [x] Public PIN-gated gallery access with failed-attempt lockout
- [x] React/Tailwind interfaces for admin, team, and public visitors
- [x] Automated API tests for auth, isolation, uploads, and galleries
- [x] Local/deployment documentation and architecture diagram

## Delivery decisions

The API is intentionally async and stores only Cloudinary metadata in MongoDB. Access
checks happen at the route/service boundary before an event, photo, or gallery can be
read or modified. Public galleries reveal neither their existence nor their content
before publication and successful PIN verification.

## Run order

1. Configure `.env` from `.env.example` and start MongoDB (or use Atlas).
2. Start FastAPI locally; Swagger is available at `/docs`.
3. Start the Vite client and set `VITE_API_URL` when needed.
4. Run `pytest` before deploying to Render and Vercel.

