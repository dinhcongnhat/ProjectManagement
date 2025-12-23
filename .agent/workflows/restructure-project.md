---
description: Tái cấu trúc phần dự án để đồng bộ admin và user
---

# Kế hoạch Tái Cấu Trúc Dự Án

## Đã hoàn thành

### 1. ✅ Cập nhật Schema Database (Prisma)
- Thêm `investor` (Chủ đầu tư) vào Project
- Thêm `cooperators` (Phối hợp thực hiện) vào Project và User
- Thêm `WorkflowStatus` enum
- Thêm `ProjectWorkflow` model để track 4 trạng thái

### 2. ✅ Cập nhật Backend
- Cập nhật `projectController.ts` với investor, cooperatorIds
- Tạo `workflowController.ts` với các API workflow
- Tạo `workflowRoutes.ts`
- Đăng ký routes trong `index.ts`

### 3. ✅ Cập nhật Frontend Form
- Cập nhật `CreateProject.tsx` với investor, cooperatorIds
- Default code prefix DA2026

### 4. ✅ Tạo Component Workflow
- Tạo `ProjectWorkflow.tsx` component để hiển thị 4 trạng thái

## Cần hoàn thiện

### 5. Tích hợp vào các trang details
- [ ] Thêm ProjectWorkflow vào `ProjectDetailsAdmin.tsx`
- [ ] Thêm ProjectWorkflow vào `ProjectDetails.tsx` (User)
- [ ] Hiển thị investor và cooperators
- [ ] Đồng bộ UI giữa Admin và User

### 6. Test
- [ ] Test tạo project mới với các trường mới
- [ ] Test workflow transitions
- [ ] Test PM approval flow

## API Endpoints mới
- GET `/api/projects/:id/workflow` - Lấy workflow
- POST `/api/projects/:id/workflow/confirm-received` - Xác nhận đã nhận
- POST `/api/projects/:id/workflow/confirm-in-progress` - Xác nhận đang thực hiện  
- POST `/api/projects/:id/workflow/approve-completed` - PM duyệt hoàn thành
- POST `/api/projects/:id/workflow/confirm-sent-to-customer` - Xác nhận gửi KH
