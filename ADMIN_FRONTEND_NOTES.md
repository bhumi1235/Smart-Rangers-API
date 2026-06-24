# Admin Frontend – Backend Support Summary

Backend changes are in place. Use this for the admin app (View Supervisor/Guard Details, Dashboard, Terminated section, logo, profile, back button).

## 1. Supervisor & Guard profile photos

- **Backend:** `getSupervisorById` and guard details now include `profileImage` using `getFileUrl()` (Cloudinary or `/uploads/...`).
- **Frontend:** Use the `profileImage` URL from the API as the `src` for the profile image. If you still see `/uploads/...`, ensure new uploads use Cloudinary and existing users re-upload their photo.

## 2. PDF / Excel download (View Supervisor Details & View Guard Details)

- **Supervisor**
  - PDF: `GET /api/admin/supervisors/:id/export/pdf` (admin auth)
  - Excel: `GET /api/admin/supervisors/:id/export/excel` (admin auth)
- **Guard** (use guard **database** `id`, not local_guard_id)
  - PDF: `GET /api/admin/guards/:id/export/pdf` (admin auth)
  - Excel: `GET /api/admin/guards/:id/export/excel` (admin auth)

Add **PDF Download** and **Excel Download** buttons on View Supervisor Details and View Guard Details that open or download these URLs (e.g. in a new tab or with `window.open` / fetch + blob download).

## 3. Dashboard counts

- **Endpoint:** `GET /api/admin/dashboard` (unchanged).
- **New fields in response:**
  - `totalActiveSupervisors`, `totalSuspendedSupervisors`, `totalTerminatedSupervisors`
  - `totalActiveGuards`, `totalSuspendedGuards`, `totalTerminatedGuards`  
  (Guards currently have no status in DB, so `totalActiveGuards` = total guards, others 0.)

Use these in the dashboard UI for “Total Active Supervisor/Guard”, “Total Suspended”, “Total Terminated”.

## 4. Terminated section – permanent delete (🗑)

- **Supervisor (only when status is Terminated):**  
  `DELETE /api/admin/supervisors/:id/permanent` (admin auth).  
  Add a 🗑 delete icon in the terminated supervisors list that calls this and then refreshes the list.
- **Guard:**  
  `DELETE /api/admin/guards/:id/permanent` (admin auth).  
  Add a 🗑 delete icon where you list guards for permanent deletion (e.g. in a “terminated” or “all guards” admin view).  
  Backend permanently deletes the guard (and related contacts/documents).

## 5. Admin app logo

- **Backend:** Static files from the `public` folder are served at the root.
- **Option A:** Put your logo file in `public/logo.png`. The app can use `https://<your-api-host>/logo.png` (or relative `/logo.png` if the admin app is on the same host).
- **Option B:** In the admin app, set the logo image `src` to your own URL (e.g. CDN or asset URL). No backend change needed.

So “change admin app logo” = point the header/sidebar logo to `/logo.png` (after placing the file in `public/`) or to another URL you provide.

## 6. Admin profile icon → profile page

- **Backend:** `GET /api/admin/profile` (admin auth) returns the current admin’s profile (e.g. id, name, email, role, created_at).
- **Frontend:** When the user clicks the admin profile icon, navigate to a profile page that:
  - Calls `GET /api/admin/profile` and shows the data (e.g. name, email).
  - Optionally add profile edit/change-password if you add those APIs later.

So “profile icon opens nothing” is fixed by wiring the icon’s `onClick` to navigation to this profile route and loading profile data from `/api/admin/profile`.

## 7. Back button color

- **Frontend only.** Change the Back button’s CSS (e.g. `background-color`, `color`, or your design system’s button variant) to the color you want. No backend changes.

---

## Quick reference – new/updated API routes (admin auth)

| Method | Route | Description |
|--------|--------|-------------|
| GET | `/api/admin/dashboard` | Now includes totalActiveSupervisors, totalSuspendedSupervisors, totalTerminatedSupervisors, totalActiveGuards, totalSuspendedGuards, totalTerminatedGuards |
| GET | `/api/admin/supervisors/:id` | Now includes `profileImage`, `terminationReason` |
| GET | `/api/admin/supervisors/:id/export/pdf` | Download supervisor details as PDF |
| GET | `/api/admin/supervisors/:id/export/excel` | Download supervisor details as Excel |
| DELETE | `/api/admin/supervisors/:id/permanent` | Permanently delete a **terminated** supervisor |
| DELETE | `/api/admin/guards/:id/permanent` | Permanently delete a guard |
| GET | `/api/admin/guards/:id/export/pdf` | Download guard details as PDF (guard DB `id`) |
| GET | `/api/admin/guards/:id/export/excel` | Download guard details as Excel (guard DB `id`) |
| GET | `/api/admin/profile` | Get current admin profile (for profile page) |
| GET | `/logo.png` | Logo file if placed in `public/logo.png` |
