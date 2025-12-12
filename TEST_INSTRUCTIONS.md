# Test Instructions

This document explains how to verify the fixes for MinIO paths and Realtime updates.

## 1. Backend Endpoint Verification

A test script `test_fix.js` has been created in the root directory. This script uses `fetch` to verify:
- Backend Health
- User Login (to get a valid token/ID)
- User Avatar Endpoint (verifies streaming works)
- Chat Attachment Endpoint (verifies 404 handling for non-existent files)

**To run the test:**

1.  Open a terminal in `c:\ProjectManagement`.
2.  Ensure the backend server is running (e.g., in a separate terminal):
    ```powershell
    cd backend
    npm run dev
    ```
3.  Run the test script using Node.js:
    ```powershell
    node test_fix.js
    ```

**Expected Output:**
- Login successful.
- User Avatar endpoint should return status 200 (if user has avatar) or 404.
- Chat Attachment endpoint should return 404 (for dummy ID).
- **Crucially**, no "redirect" or "CORS" errors should occur for the avatar request.

## 2. Frontend Realtime & UI Verification

1.  Open the application in a browser (e.g., http://localhost:5173 or https://jtsc.io.vn).
2.  **Avatar Display**: Check if your user avatar and other users' avatars are visible.
3.  **Group Creation**:
    - Click "Create Group".
    - Upload a group avatar.
    - Create the group.
    - **Verify**: The new group should appear in the chat list *immediately* with the correct avatar, without refreshing the page.
4.  **Mobile Interface**:
    - Open Developer Tools (F12) and toggle Device Toolbar (Ctrl+Shift+M).
    - Select a mobile device (e.g., iPhone 12).
    - Open Chat. It should slide in from the right and cover the screen (fullscreen mode).
    - Transitions should be smooth.

## Key Changes Made

- **Backend**: Updated `userController.ts` and `chatController.ts` to **stream** files directly from MinIO to the client, bypassing presigned URL redirects. This resolves internal network access issues and mixed content/CORS problems.
- **Frontend**: Added `slideInRight` animation configuration in `tailwind.config.js` for better mobile experience.
