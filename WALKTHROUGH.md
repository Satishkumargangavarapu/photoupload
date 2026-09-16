# Walkthrough: Persistent Data, Team Member Uploads, 4-Digit PIN Link Sharing & Activity History

## 1. Summary of What Was Implemented

### 1. Data Permanence & No More Lost Data on Backend Restart
- **Root Cause Identified**: The backend startup lifecycle function (`bootstrap_super_admin` in `backend/app/main.py`) previously executed `db.users.delete_many`, `db.events.delete_many`, `db.photos.delete_many`, and `db.galleries.delete_many` every time the server booted.
- **Fix Applied**: Completely removed the data deletion calls. On startup, the backend only ensures that the Super Admin exists if not already present. **All users, studios, events, uploaded photos, share links, and activity logs remain safely and permanently stored in MongoDB.**

---

### 2. Team Member Multi-Photo Upload Portal
- Team members assigned to an event can upload multiple photos simultaneously using drag-and-drop or multi-file selection.
- Shows real-time progress (`Uploading 1 of 5...`) and instant confirmation upon completion.
- Team members can toggle between **All Event Photos** and **My Uploads** to see the full event gallery as well as their own contributions.
- Click any photo to preview in high-resolution with the built-in Lightbox modal.

---

### 3. Role-Based Gallery Publishing & 4–8 Digit Access PIN (e.g. 482917)
- **Role Isolation Enforced**:
  - **Admin / Event Manager Only**: Consolidate uploaded photos, select specific photos for sharing (or all), generate shareable links, and publish galleries.
  - **Team Members Restricted**: Assigned team members focus on multi-photo uploads and reviewing their contributions. Attempting to generate share links or publish galleries is blocked at the API level (`HTTP 403 Forbidden`).
- **Flexible 4–8 Digit PIN Support**:
  - Supports standard 4-digit PINs (e.g. `1234`) as well as 6-digit PINs (e.g. `482917` from the specification operational state).
  - Quick buttons for both **6-Digit** and **4-Digit** secure random PIN generation in the Admin workspace.
- **Immediate Publishing & Quick Copy Actions**:
  - **Copy Share Link**: Copies the gallery URL (`/gallery/:slug`) to clipboard.
  - **Copy Full Invite Message**: Copies `"View photos from [Event Name]: http://.../gallery/:slug \nAccess PIN: 482917"`.
- **Zero Friction for Guests**:
  - Customers/guests access `/gallery/:slug` without creating an account.
  - Enter the access PIN (e.g. `482917`), browse curated photos, preview in high-resolution Lightbox, and download images.

---

### 4. Activity History & Audit Trail ("Every person has history of what they are doing")
- Every action across the platform is logged to an audit trail in MongoDB (`activities` collection):
  - Access requests and approval/rejection decisions
  - Studio invites and member assignments
  - Photo uploads (with photo filename and uploader name)
  - Access PIN share link creation and updates
  - Guest unlocks and access
- **Activity History Views**:
  - **Team Member & Event Manager Workspace**: Dedicated "Event Activity History" tab showing the timeline of actions for that event.
  - **Studio Dashboard**: Dedicated "Activity History" tab showing all actions across the studio.
  - **Super Admin Dashboard**: "Platform History" tab showing platform-wide audit logs.

---

## 2. Key Files Updated

| File | Changes |
| :--- | :--- |
| [`backend/app/main.py`](file:///c:/Users/HP/Documents/ChatGPT/photoupload/backend/app/main.py) | Enforced `event_manager` / `super_admin` role checks on `POST /events/{id}/share-link` and `PATCH /galleries/{id}/publish` (blocking team members with `403 Forbidden`). |
| [`backend/app/schemas.py`](file:///c:/Users/HP/Documents/ChatGPT/photoupload/backend/app/schemas.py) | Updated `ShareLinkIn` to support 4–8 digit PINs (`^\d{4,8}$`), supporting 6-digit PINs like `482917`. |
| [`backend/tests/test_requirements.py`](file:///c:/Users/HP/Documents/ChatGPT/photoupload/backend/tests/test_requirements.py) | Added regression tests verifying team member publish rejection (`403 Forbidden`) and 6-digit PIN gallery unlocking (`482917`). |
| [`frontend/src/main.tsx`](file:///c:/Users/HP/Documents/ChatGPT/photoupload/frontend/src/main.tsx) | Updated `EventManager` to support 4–8 digit PINs with 6-digit/4-digit random generators; updated `Upload` to present clean photographer portal with read-only gallery status; updated `PublicGallery` PIN unlock to support 4–8 digit PINs. |

---

## 3. Verification & Testing Instructions

1. **Verify Role Isolation (Admin vs. Team Member)**:
   - Sign in as an Event Manager. Go to an event workspace, select photos, set a 6-digit PIN (e.g. `482917`), and click **Publish Gallery & Generate Link**.
   - Sign in as a Team Member assigned to the event. Notice the workspace provides multi-photo upload and contribution metrics, while gallery publishing controls are strictly reserved for the Admin.
2. **Verify 6-Digit PIN Guest Access**:
   - Open a private/incognito browser window.
   - Navigate to the generated gallery link (`http://localhost:5173/gallery/:slug`).
   - Enter `482917`.
   - The gallery unlocks immediately, showing the curated event photos with Lightbox preview and downloads.
3. **Verify Automated Tests**:
   - Run `pytest` in `backend/` to verify all regression tests pass (including `test_team_member_cannot_publish_gallery_or_generate_share_link` and `test_gallery_supports_six_digit_pin`).
