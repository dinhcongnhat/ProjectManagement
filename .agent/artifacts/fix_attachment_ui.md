# Fix Attachment UI Issues

## Problems

### 1. CreateProjectModal Needs Card-Based UI (Like Image 1) ⏳
**Current**: Dropdown with 3 options
**Need**: Card-based layout displaying all 3 options visibly:
- Tải lên từ thiết bị của bạn (Upload icon)
- Từ thư mục (Folder icon)  
- Google Drive (Google Drive icon)

### 2. ProjectAttachments Missing Google Drive ⏳
**Current**: Dropdown with 3 options:
- File từ thiết bị
- Thư mục từ thiết bị
- Từ Kho dữ liệu

**Missing**: Google Drive option

**Locations affected**:
- "T ài liệu dự án" section
- "Báo cáo kết quả" section  

## Solutions

### Solution 1: Create Card UI for CreateProjectModal

Replace dropdown (lines 450-515) with card layout:

```tsx
<div className="space-y-3">
    <label className="block text-sm font-medium text-gray-700">
        Đính kèm
    </label>
    
    {/* Card 1: Upload from device */}
    <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/30 transition-all"
    >
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <CloudUpload size={24} className="text-blue-600" />
        </div>
        <div className="text-left">
            <p className="font-medium text-gray-900">Tải lên từ thiết bị của bạn</p>
            <p className="text-sm text-gray-500">Chọn tệp từ thiết bị của bạn</p>
        </div>
    </button>

    {/* Card 2: From folder */}
    <button
        type="button"
        onClick={() => setShowFilePicker(true)}
        className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-amber-300 hover:bg-amber-50/30 transition-all"
    >
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
            <FolderOpen size={24} className="text-amber-600" />
        </div>
        <div className="text-left">
            <p className="font-medium text-gray-900">Từ thư mục</p>
            <p className="text-sm text-gray-500">Chọn tệp từ thư mục cá nhân của bạn</p>
        </div>
    </button>

    {/* Card 3: Google Drive */}
    <button
        type="button"
        onClick={() => setShowDriveBrowser(true)}
        className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50/30 transition-all"
    >
        <div className="w-12 h-12 bg-white border border-gray-200 rounded-full flex items-center justify-center shrink-0">
            <GoogleDriveIcon />
        </div>
        <div className="text-left">
            <p className="font-medium text-gray-900">Google Drive</p>
            <p className="text-sm text-gray-500">Chọn tệp từ Google Drive</p>
        </div>
    </button>
</div>
```

### Solution 2: Add Google Drive to ProjectAttachments

Need to find the dropdown in ProjectAttachments.tsx and add Google Drive option.

Search for:
- `HardDrive` icon usage
- `FolderOpen` icon usage  
- Where dropdown menu is rendered

Then add:
```tsx
<button
    onClick={handleSelectFromDrive}
    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 transition-colors text-sm"
>
    <GoogleDriveIcon />
    <span className="text-gray-700">Google Drive</span>
</button>
```

## Files to Modify

1. ✅ `CreateProjectModal.tsx` - Replace dropdown with cards (lines 450-515)
2. ⏳ `ProjectAttachments.tsx` - Add Google Drive option to dropdown
