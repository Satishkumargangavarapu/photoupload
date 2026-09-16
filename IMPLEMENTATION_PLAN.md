# Implementation Plan: Team Member Event Uploads & 4-Digit PIN Shareable Link

Enable team members to upload photos directly into their assigned events, and empower both team members and event managers to generate and manage private, 4-digit PIN-protected shareable links with one-click sharing.

## User Review Required

> [!IMPORTANT]
> **4-Digit Password Format**: The access password for the generated share link will be enforced as an exact **4-digit numeric code** (e.g. `1234`, `8042`), with an interactive "Generate Random 4-Digit PIN" button to create secure PINs instantly.
> 
> **Role Permissions for Sharing**: Both **Event Managers** and **assigned Team Members** will have full permissions to generate the shareable link, view the active link and PIN, copy invite messages, and update the 4-digit PIN for the event.
> 
> **Automatic Inclusion of Uploaded Photos**: When a share link is created for an event, all uploaded photos in the event (including newly uploaded photos by any team member or manager) will automatically be available in the public guest gallery without needing manual re-selection.

---

## Proposed Changes

### Backend Components

#### [MODIFY] [`backend/app/schemas.py`](file:///c:/Users/HP/Documents/ChatGPT/photoupload/backend/app/schemas.py)
- Update `GalleryIn` and add `ShareLinkIn`:
  - Enforce 4-digit PIN: `pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")`
  - Make `photo_ids` optional (defaults to all event photos if omitted).
- Add `GalleryOut` / `ShareInfoOut` schema:
  - Returns `id`, `slug`, `pin_preview` (or plain PIN for authorized team/manager view), `is_published`, `share_url`, `photo_count`, `created_at`.

#### [MODIFY] [`backend/app/main.py`](file:///c:/Users/HP/Documents/ChatGPT/photoupload/backend/app/main.py)
- **Allow Team Members to Generate & Update Share Links**:
  - Update `POST /events/{event_id}/gallery` and add `POST /events/{event_id}/share-link` so any authorized user for the event (manager owner or assigned team member) can generate or update the event's share link with a 4-digit PIN.
  - Automatically publish the gallery (`is_published: True`) upon generation so the link is immediately active and ready to share.
- **Add Persistent Gallery Discovery**:
  - Add `GET /events/{event_id}/gallery`: returns current share link, slug, 4-digit PIN, and publishing status for any assigned member or manager. (Solves the issue where reloading the page lost the generated link).
- **Enhance Photo Listing for Team Members**:
  - Update `GET /events/{event_id}/photos` so team members can view all photos in their assigned event (or filter with `?mine=true` for their own uploads).
- **Public PIN Verification**:
  - Ensure `POST /gallery/{slug}/access` validates against the 4-digit PIN and returns all event photos.

---

### Frontend Components

#### [MODIFY] [`frontend/src/main.tsx`](file:///c:/Users/HP/Documents/ChatGPT/photoupload/frontend/src/main.tsx)
- **Revamp Team Member Event Workspace (`Upload` component)**:
  - **Multi-Photo Upload Portal**: Drag-and-drop zone supporting multiple file selection, batch uploading with real-time status indicators, and immediate preview.
  - **4-Digit PIN Share Portal**:
    - Dedicated "Share Event Gallery" card.
    - 4-Digit PIN input field with numeric validation and "Generate Random 4-Digit PIN" helper.
    - "Generate Share Link" action.
    - Once generated, displays:
      - Full shareable link (e.g. `http://localhost:5173/gallery/{slug}`) with **Copy Link** button.
      - The 4-digit PIN with a copy button.
      - **"Copy Invite Message"** button: copies `"View our event photos here: http://localhost:5173/gallery/{slug} | PIN: 1234"`.
      - Ability to update/change the 4-digit PIN anytime.
  - **Event Photo Gallery**:
    - View all photos uploaded to the event by the studio team.
    - Tab toggle between "All Event Photos" and "My Uploads".
    - Click-to-enlarge photo lightbox modal.
- **Revamp Event Manager Workspace (`EventManager` component)**:
  - Integrate `GET /events/{id}/gallery` so existing share links and 4-digit PINs persist across page reloads.
  - Add direct photo upload capability so event managers can also upload photos directly.
  - Add 4-digit PIN generator with "Generate Random PIN" and 1-click Invite copying.
- **Enhance Public Gallery PIN Access (`PublicGallery` component)**:
  - Refined 4-digit PIN entry interface (distinct 4-digit layout, auto-focus, numeric keypad on mobile).
  - Clean error messaging and locked status alert.
  - Responsive dark-mode gallery viewer with full image expansion.

---

## Verification Plan

### Manual Verification Flow
1. **Team Member Upload**:
   - Sign in as a team member assigned to an event.
   - Go to the event workspace.
   - Upload multiple photos at once; verify they upload successfully and appear in the gallery.
2. **Team Member 4-Digit Share Link Generation**:
   - In the "Share Event Gallery" section, enter a 4-digit PIN (e.g. `4829`) or click "Generate Random PIN".
   - Click "Generate Share Link".
   - Verify the share URL is generated with the 4-digit PIN.
   - Test "Copy Link" and "Copy Invite".
3. **Public Guest Access**:
   - Open an incognito / private browser window (or unauthenticated tab).
   - Navigate to the generated `/gallery/:slug` URL.
   - Verify the 4-digit PIN entry screen appears.
   - Enter an incorrect PIN: verify it shows an error.
   - Enter the correct 4-digit PIN: verify the event photos appear in high resolution.
4. **Event Manager View & Persistence**:
   - Sign in as the Event Manager and navigate to the event.
   - Verify the same active share link and 4-digit PIN are loaded and visible.
   - Verify the manager can also update the PIN or upload photos.
