# Fix Avatar Display Issues

## Problem
Avatars are not displaying correctly in 3 locations:
1. **ShareDialog** (UserFolders.tsx) - User sharing modal
2. **ChatPopup** - Conversation list & user search in chat info panel  
3. **Search results** - When searching for users/conversations

## Root Cause
Avatar URLs are not being constructed correctly. Need to use `/api/users/{userId}/avatar` endpoint.

## Files to Fix

### 1. UserFolders.tsx - ShareDialog Component (Line 265-266)

**Current (WRONG)**:
```tsx
<div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
    {u.avatar ? <img src={u.avatar} className="w-8 h-8 rounded-full" /> : (u.name?.[0] || 'U')}
</div>
```

**Fix**:
```tsx
<div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium overflow-hidden">
    {u.avatar ? (
        <img src={`${API_URL}/users/${u.id}/avatar`} className="w-8 h-8 rounded-full object-cover" alt={u.name} />
    ) : (
        <span>{u.name?.[0] || 'U'}</span>
    )}
</div>
```

### 2. ChatPopup.tsx - Conversation List & User Search

Need to find and fix similar patterns in ChatPopup.tsx for:
- Conversation list items
- User search results in info panel

**Pattern to search**: Avatar rendering in conversation/user lists
**Fix**: Use `${API_URL}/users/${userId}/avatar` for user avatars

## Implementation Steps

1. Fix ShareDialog in UserFolders.tsx
2. Find avatar rendering in ChatPopup.tsx
3. Apply same fix pattern
4. Test all 3 locations

## Notes
- Always use `${API_URL}/users/${userId}/avatar` for user avatars
- Add `object-cover` class for proper sizing
- Add `overflow-hidden` to parent div
- Include `alt` attribute for accessibility
