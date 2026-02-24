import React, { useState, useEffect } from 'react';
import { X, Search, Layout, CheckCircle, ChevronRight, Hash } from 'lucide-react';
import api from '../../config/api';

interface KanbanCardPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (card: { boardId: number; cardId: number; boardTitle: string; cardTitle: string }) => void;
}

interface KanbanBoard {
    id: number;
    title: string;
}

interface KanbanCard {
    id: number;
    title: string;
    description: string | null;
    completed: boolean;
    listId: number;
}

interface KanbanList {
    id: number;
    title: string;
    cards: KanbanCard[];
}

export const KanbanCardPickerModal: React.FC<KanbanCardPickerModalProps> = ({
    isOpen,
    onClose,
    onSelect
}) => {
    const [boards, setBoards] = useState<KanbanBoard[]>([]);
    const [selectedBoard, setSelectedBoard] = useState<KanbanBoard | null>(null);
    const [lists, setLists] = useState<KanbanList[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [cardSearchQuery, setCardSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchBoards();
            setSelectedBoard(null);
            setLists([]);
            setSearchQuery('');
            setCardSearchQuery('');
        }
    }, [isOpen]);

    const fetchBoards = async () => {
        setLoading(true);
        try {
            const res = await api.get('/kanban/boards');
            setBoards(res.data);
        } catch (error) {
            console.error('Error fetching boards:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBoardDetails = async (board: KanbanBoard) => {
        setSelectedBoard(board);
        setLoading(true);
        try {
            const res = await api.get(`/kanban/boards/${board.id}`);
            // res.data có lists -> l.cards
            if (res.data && res.data.lists) {
                setLists(res.data.lists);
            } else {
                setLists([]);
            }
        } catch (error) {
            console.error('Error fetching board details:', error);
            setLists([]);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const filteredBoards = boards.filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        {selectedBoard && (
                            <button
                                onClick={() => setSelectedBoard(null)}
                                className="p-1 hover:bg-gray-100 rounded-full mr-1 transition-colors text-gray-500"
                            >
                                <ChevronRight className="rotate-180" size={20} />
                            </button>
                        )}
                        <Layout className="text-purple-600" size={24} />
                        <h2 className="text-xl font-bold font-display text-gray-800">
                            {selectedBoard ? `Bảng: ${selectedBoard.title}` : 'Đính kèm Thẻ Kanban'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/50">
                    {!selectedBoard ? (
                        <>
                            <div className="p-4 border-b border-gray-100">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Tìm kiếm bảng..."
                                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {loading ? (
                                    <div className="flex justify-center py-8"><div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin"></div></div>
                                ) : filteredBoards.length > 0 ? (
                                    filteredBoards.map(board => (
                                        <button
                                            key={board.id}
                                            onClick={() => fetchBoardDetails(board)}
                                            className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                                                    <Layout size={20} />
                                                </div>
                                                <span className="font-semibold text-gray-700 text-left">{board.title}</span>
                                            </div>
                                            <ChevronRight size={20} className="text-gray-300 group-hover:text-purple-500 transition-colors" />
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-gray-500 flex flex-col items-center">
                                        <Layout size={48} className="text-gray-200 mb-4" />
                                        <p>Không tìm thấy bảng nào</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-white">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Tìm kiếm thẻ..."
                                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50"
                                        value={cardSearchQuery}
                                        onChange={(e) => setCardSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                                {loading ? (
                                    <div className="flex justify-center py-8"><div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin"></div></div>
                                ) : lists.length > 0 ? (
                                    lists.map(list => {
                                        const filteredCards = list.cards.filter(c =>
                                            c.title.toLowerCase().includes(cardSearchQuery.toLowerCase()) ||
                                            (c.description || '').toLowerCase().includes(cardSearchQuery.toLowerCase())
                                        );

                                        if (cardSearchQuery && filteredCards.length === 0) return null;

                                        return (
                                            <div key={list.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-semibold text-gray-700 flex justify-between items-center">
                                                    <span>{list.title}</span>
                                                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{filteredCards.length} thẻ</span>
                                                </div>
                                                <div className="divide-y divide-gray-100">
                                                    {filteredCards.length > 0 ? (
                                                        filteredCards.map(card => (
                                                            <button
                                                                key={card.id}
                                                                onClick={() => onSelect({
                                                                    boardId: selectedBoard.id,
                                                                    cardId: card.id,
                                                                    boardTitle: selectedBoard.title,
                                                                    cardTitle: card.title
                                                                })}
                                                                className="w-full p-4 flex gap-3 text-left hover:bg-purple-50 transition-colors group"
                                                            >
                                                                <div className="pt-0.5">
                                                                    {card.completed ? (
                                                                        <CheckCircle className="text-green-500" size={18} />
                                                                    ) : (
                                                                        <Hash className="text-purple-400 group-hover:text-purple-600" size={18} />
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className={`font-medium ${card.completed ? 'text-gray-500 line-through' : 'text-gray-800 group-hover:text-purple-700'}`}>
                                                                        {card.title}
                                                                    </div>
                                                                    {card.description && (
                                                                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">{card.description}</div>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <div className="py-4 text-center text-sm text-gray-400 italic">Danh sách trống</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-10 text-gray-500 flex flex-col items-center">
                                        <Hash size={48} className="text-gray-200 mb-4" />
                                        <p>Không có danh sách / thẻ nào trong bảng này</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
