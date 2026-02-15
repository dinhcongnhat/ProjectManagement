import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import multer from 'multer';
import {
    getBoards,
    createBoard,
    getBoardById,
    updateBoard,
    deleteBoard,
    addBoardMember,
    removeBoardMember,
    createList,
    updateList,
    deleteList,
    reorderLists,
    createCard,
    updateCard,
    deleteCard,
    moveCard,
    approveCard,
    reorderCards,
    createLabel,
    deleteLabel,
    getCardComments,
    addCardComment,
    deleteComment,
    getCardChecklist,
    addChecklistItem,
    updateChecklistItem,
    deleteChecklistItem,
    getCardAttachments,
    uploadCardAttachment,
    uploadCardAttachmentFromFolder,
    uploadCardAttachmentFromDrive,
    deleteCardAttachment,
    getAttachmentPresignedUrl,
    getUpcomingCards,
    searchCards
} from '../controllers/kanbanController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateToken);

// Upcoming cards (for dashboard)
router.get('/cards/upcoming', getUpcomingCards);
router.get('/cards/search', searchCards);

// Boards
router.get('/boards', getBoards);
router.post('/boards', createBoard);
router.get('/boards/:id', getBoardById);
router.put('/boards/:id', updateBoard);
router.delete('/boards/:id', deleteBoard);

// Board Members
router.post('/boards/:id/members', addBoardMember);
router.delete('/boards/:id/members/:memberId', removeBoardMember);

// Lists
router.post('/boards/:boardId/lists', createList);
router.put('/lists/:id', updateList);
router.delete('/lists/:id', deleteList);
router.put('/boards/:boardId/lists/reorder', reorderLists);

// Cards
router.post('/lists/:listId/cards', createCard);
router.put('/cards/:id', updateCard);
router.delete('/cards/:id', deleteCard);
router.put('/cards/:id/move', moveCard);
router.put('/cards/:id/approve', approveCard);
router.put('/lists/:listId/cards/reorder', reorderCards);

// Labels
router.post('/boards/:boardId/labels', createLabel);
router.delete('/labels/:id', deleteLabel);

// Comments
router.get('/cards/:cardId/comments', getCardComments);
router.post('/cards/:cardId/comments', addCardComment);
router.delete('/comments/:id', deleteComment);

// Checklist
router.get('/cards/:cardId/checklist', getCardChecklist);
router.post('/cards/:cardId/checklist', addChecklistItem);
router.put('/checklist/:id', updateChecklistItem);
router.delete('/checklist/:id', deleteChecklistItem);

// Attachments
router.get('/cards/:cardId/attachments', getCardAttachments);
router.post('/cards/:cardId/attachments', upload.array('files', 10), uploadCardAttachment);
router.post('/cards/:cardId/attachments/from-folder', uploadCardAttachmentFromFolder);
router.post('/cards/:cardId/attachments/from-drive', uploadCardAttachmentFromDrive);
router.delete('/attachments/:id', deleteCardAttachment);
router.get('/attachments/:id/presigned-url', getAttachmentPresignedUrl);

export default router;
