# Fix Header Sticky & Attachment Picker

## Vấn đề cần fix

### 1. Header không sticky đúng cách ✅ 
**Hiện tại**: Header.tsx đã có `sticky top-0 z-40` nhưng vẫn bị mất/dịch chuyển khi scroll

**Nguyên nhân có thể**:
- Parent container có `overflow: hidden` hoặc `overflow: auto`
- Layout page không dùng min-h-screen/flex đúng cách
- Z-index conflicts

**Giải pháp**:
1. Đảm bảo parent của Header KHÔNG có overflow hidden/auto
2. Thêm `bg-white` vào header chính thay vì dùng absolute backdrop
3. Tăng z-index nếu cần: `z-50` thay vì `z-40`

### 2. Mobile Header cũng cần sticky
- Đã có `paddingTop: 'env(safe-area-inset-top)'` ✅
- Cần đảm bảo responsive layout không che Header

### 3. Attachment Picker trong CreateProjectModal
**Hiện tại**: Custom implementation với dropdown
- Dòng 450-515: Custom dropdown với 3 options
- Tải lên từ thiết bị
- Từ thư mục
- Google Drive

**Có thể**: User muốn dùng AttachmentPicker component cho consistency

## Implementation Plan

### Step 1: Fix Header Sticky
File: `src/components/Header.tsx`

**Thay đổi**:
```tsx
<header
    className="h-16 border-b border-gray-200/50 flex items-center px-4 lg:px-6 sticky top-0 z-50 bg-white"
    style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
>
    {/* Remove backdrop div */}
    ...
</header>
```

### Step 2: Kiểm tra Page Layout
Cần check các page chính:
- ProjectDetailsAdmin.tsx
- ProjectDetails.tsx  
- CompanyChat.tsx
- UserFolders.tsx

Đảm bảo không có overflow hidden ở container chính

### Step 3: (Optional) Refactor Attachment Picker
Nếu user muốn consistency, có thể dùng AttachmentPicker component thay vì custom dropdown

## Các file cần sửa

1. ✅ **Header.tsx** - Fix sticky
2. ⏳ **ProjectDetailsAdmin.tsx** - Check layout
3. ⏳ **CreateProjectModal.tsx** - (Optional) Use AttachmentPicker
