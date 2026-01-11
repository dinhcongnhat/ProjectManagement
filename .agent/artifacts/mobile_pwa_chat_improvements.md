# Mobile UI, PWA & Chat Improvements - Implementation Plan

## User Requirements
1. **Mobile UI**: Fix header (sticky/fixed) và cải thiện giao diện
2. **PWA**: Đảm bảo đầy đủ chức năng như web
3. **Chat Media/Files**: Fix lỗi không xem được ảnh/file cũ trên mobile

## Issues Identified

### 1. Chat Media/Files Endpoint Missing
- Frontend calls: `GET /chat/conversations/:id/media?type=media|files`
- Backend: **Endpoint không tồn tại** → 404 error
- **Impact**: Không thể xem lại ảnh/file cũ trong chat info sidebar

### 2. Mobile UI Headers Not Fixed
- ChatPopup headers scroll với nội dung
- Cần: `position: sticky` hoặc `fixed`

### 3. PWA Functionality
- Cần kiểm tra manifest, service worker
- Đảm bảo offline capability

## Implementation Steps

### Phase 1: Fix Chat Media/Files Viewing (CRITICAL)

#### Step 1.1: Create Backend Endpoint
File: `backend/src/controllers/chatController.ts`

```typescript
export const getConversationMedia = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { type } = req.query; // 'media' | 'files'

        // Check permission
        const isMember = await prisma.conversationMember.findUnique({
            where: {
                conversationId_userId: {
                    conversationId: Number(id),
                    userId
                }
            }
        });

        if (!isMember) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Query messages with attachments
        const whereClause: any = {
            conversationId: Number(id),
            attachment: { not: null }
        };

        if (type === 'media') {
            // Images only
            whereClause.messageType = { in: ['IMAGE', 'TEXT_WITH_FILE'] };
            // Additionally filter by actual image mime types if stored
        } else if (type === 'files') {
            // Files only (not images)
            whereClause.messageType = { in: ['FILE', 'TEXT_WITH_FILE', 'VOICE'] };
        }

        const messages = await prisma.chatMessage.findMany({
            where: whereClause,
            include: {
                sender: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50 // Limit results
        });

        // Add attachmentUrl for each message
        const messagesWithUrls = messages.map(msg => ({
            ...msg,
            attachmentUrl: `/api/chat/conversations/${id}/messages/${msg.id}/file`
        }));

        res.json(messagesWithUrls);
    } catch (error) {
        console.error('Error fetching conversation media:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
```

#### Step 1.2: Register Route
File: `backend/src/routes/chatRoutes.ts`
- Ensure route is registered (already exists based on grep)

#### Step 1.3: Test Endpoint
- Test with Postman/curl
- Verify attachmentUrl is correct

### Phase 2: Fix Mobile UI Headers

#### Step 2.1: ChatPopup Mobile View
File: `frontend/src/components/ChatPopup.tsx`

**Find mobile chat render function and apply:**
- Header: `className="sticky top-0 z-10 bg-white ..."`
- Or: `className="fixed top-0 left-0 right-0 z-50 bg-white ..."`

**Ensure:**
- Header doesn't scroll with messages
- Messages area has proper padding-top to not hide under header
- Smooth scrolling behavior

#### Step 2.2: Improve Mobile Aesthetics
- Better spacing, shadows
- Consistent color scheme
- Touch-friendly tap targets (min 44x44px)

### Phase 3: PWA Enhancements

#### Step 3.1: Verify manifest.json
- Check icons (192x192, 512x512)
- `display: "standalone"`
- `start_url`, `scope` correct

#### Step 3.2: Service Worker
- Offline fallback
- Cache strategies for:
  - Static assets: Cache-first
  - API calls: Network-first with fallback
  - Images: Cache-first with network fallback

#### Step 3.3: Add to Home Screen Prompt
- Detect if not installed
- Show prompt after user engagement

## Testing Checklist

### Chat Media/Files
- [ ] Click "Media" tab in chat info → See images
- [ ] Click "Files" tab → See files
- [ ] Click on old image → Opens correctly
- [ ] Click on old file → Downloads correctly
- [ ] No 404 errors in console

### Mobile UI
- [ ] Header stays at top when scrolling messages
- [ ] No overlapping content
- [ ] Back button works
- [ ] Smooth animations

### PWA
- [ ] Install prompt appears
- [ ] Works offline (basic UI)
- [ ] Push notifications work
- [ ] Looks native on home screen

## Priority Order
1. **HIGH**: Chat media endpoint (user can't view old files)
2. **MEDIUM**: Mobile header fixed
3. **LOW**: PWA enhancements (already mostly working)
