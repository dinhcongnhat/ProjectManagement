# Chat Upload & Mobile UI Fixes

## Date: 2024

## Issues Fixed

### 1. **Upload Progress Stuck at 0%**
**Problem**: Images and files showed 0% upload progress and didn't upload
**Root Cause**: 
- Wrong endpoint: Using `/messages` instead of `/messages/file`
- No upload progress tracking (fetch API doesn't support native progress)

**Solution**:
- Changed endpoint to `/chat/conversations/:id/messages/file` ✅
- Switched from `fetch` to `XMLHttpRequest` for upload progress tracking ✅
- Added real-time progress updates using `xhr.upload.progress` event ✅

### 2. **Backend req.body Undefined Error**
**Problem**: `Cannot destructure property 'content' of 'req.body' as it is undefined`
**Root Cause**: Frontend was sending FormData to the text message endpoint
**Solution**: 
- Separated file upload endpoint: `/messages/file` (FormData)
- Text message endpoint: `/messages` (JSON)
- Proper routing ensures correct data format ✅

### 3. **Mobile Send Button Not Visible**
**Problem**: Send button hidden/overflow on mobile screens
**Root Cause**: 
- No `shrink-0` classes on buttons
- Icons too large (24px)
- Missing Mic button caused layout issues

**Solution**:
- Added `shrink-0` to all 5 buttons (Smile, Paperclip, Camera, Send, Mic) ✅
- Reduced icon sizes from 24px to 20px ✅
- Added missing Mic button ✅
- Improved input sizing with `min-w-0` and `flex-1` ✅

### 4. **Icon Confusion**
**Problem**: Image icon used for camera capture function
**Solution**:
- Replaced Image icon with Camera icon ✅
- Updated tooltips for clarity:
  - Paperclip: "Đính kèm file/ảnh/video"
  - Camera: "Chụp ảnh từ camera"
  - Mic: "Ghi âm" ✅

## Code Changes

### ChatPopup.tsx
1. **Import API_URL**:
```typescript
import api, { API_URL } from '../config/api';
```

2. **handleFileUpload - XMLHttpRequest with Progress**:
```typescript
const handleFileUpload = async (conversationId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('messageType', isImage ? 'IMAGE' : 'FILE');

    // Use XMLHttpRequest for upload progress tracking
    const token = localStorage.getItem('token');
    const response = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentCompleted = Math.round((e.loaded * 100) / e.total);
                setUploadProgress(prev => ({ ...prev, [conversationId]: percentCompleted }));
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error(`Upload failed: ${xhr.status}`));
            }
        });
        
        xhr.open('POST', `${API_URL}/chat/conversations/${conversationId}/messages/file`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
    });
};
```

3. **Mobile Input Layout**:
```tsx
<div className="flex items-center gap-2">
    <button className="shrink-0 p-2"><Smile size={20} /></button>
    <button className="shrink-0 p-2"><Paperclip size={20} /></button>
    <button className="shrink-0 p-2"><Camera size={20} /></button>
    <input className="flex-1 px-3 py-2.5 min-w-0" />
    <button className="shrink-0 p-2"><Send size={20} /></button>
    <button className="shrink-0 p-2"><Mic size={20} /></button>
</div>
```

## Backend Routes (No Changes Needed)
```typescript
// chatRoutes.ts
router.post('/conversations/:id/messages', sendMessage);              // JSON text
router.post('/conversations/:id/messages/file', upload.single('file'), sendFileMessage); // FormData files
router.post('/conversations/:id/messages/voice', upload.single('audio'), sendVoiceMessage); // FormData audio
```

## Testing Checklist

### Mobile UI
- [ ] All 5 buttons visible (Smile, Paperclip, Camera, Send, Mic)
- [ ] Icons properly sized at 20px
- [ ] No button overflow on small screens
- [ ] Input field responsive with proper text truncation
- [ ] Touch targets adequate for mobile (minimum 44x44px)

### File Upload
- [ ] Progress shows 0% → actual progress → 100%
- [ ] Images upload successfully
- [ ] Files (PDF, documents) upload successfully
- [ ] Upload errors show proper error messages
- [ ] Uploaded files display in chat

### Camera Capture
- [ ] Camera icon triggers camera on mobile
- [ ] Captured photos upload with progress
- [ ] Camera permission prompts work

### Message Sending
- [ ] Text messages send successfully
- [ ] No "req.body undefined" errors in backend logs
- [ ] Messages appear in chat immediately
- [ ] WebSocket real-time updates work

## Key Technical Details

### Why XMLHttpRequest?
- `fetch()` API doesn't support upload progress tracking natively
- `XMLHttpRequest.upload.onprogress` provides real-time upload progress
- Standard approach for file upload progress in browsers

### Why Separate Endpoints?
- Text messages use JSON body → require `express.json()` middleware
- File uploads use FormData → require `multer` middleware
- Mixing data formats in one endpoint causes parsing issues

### Why shrink-0?
- Tailwind `shrink-0` prevents flex items from shrinking below min-width
- Critical for fixed-width buttons in tight mobile layouts
- Without it, buttons can collapse when input field expands

## Build Output
```
✓ 1765 modules transformed
dist/index.html                                    3.10 kB │ gzip:   1.11 kB
dist/assets/index-Byv7aBH4.css                    67.87 kB │ gzip:  11.00 kB
dist/assets/workbox-window.prod.es5-BIl4cyR9.js    5.76 kB │ gzip:   2.37 kB
dist/assets/index-C7kAbLuU.js                    525.86 kB │ gzip: 149.49 kB
✓ built in 8.68s
```

## Next Steps
1. Deploy frontend build to production
2. Test all upload functionality on mobile devices
3. Monitor backend logs for any remaining errors
4. Test camera capture on various mobile browsers
5. Verify real-time message updates via WebSocket
