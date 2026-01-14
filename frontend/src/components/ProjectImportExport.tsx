import React, { useState, useEffect } from 'react';
import {
    Download,
    FileSpreadsheet,
    X,
    Loader2,
    FileDown,
    Check,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { API_URL } from '../config/api';

interface Project {
    id: number;
    code: string;
    name: string;
    manager?: { name: string };
    children?: { id: number }[];
}

interface ProjectExportProps {
    onClose: () => void;
    onSuccess?: () => void;
}

const ProjectExport: React.FC<ProjectExportProps> = ({
    onClose,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingProjects, setIsLoadingProjects] = useState(true);
    const [exportType, setExportType] = useState<'selected' | 'all'>('all');
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showProjectList, setShowProjectList] = useState(false);

    const token = localStorage.getItem('token');

    // Fetch parent projects
    useEffect(() => {
        const fetchProjects = async () => {
            setIsLoadingProjects(true);
            try {
                const response = await fetch(`${API_URL}/projects`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    // Filter only parent projects (no parentId)
                    const parentProjects = data.filter((p: any) => !p.parentId);
                    setProjects(parentProjects);
                }
            } catch (error) {
                console.error('Error fetching projects:', error);
            } finally {
                setIsLoadingProjects(false);
            }
        };
        fetchProjects();
    }, [token]);

    const toggleProject = (id: number) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const selectAll = () => {
        setSelectedIds(new Set(projects.map(p => p.id)));
    };

    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    // Handle export - chỉ export dự án cha (không có parentId)
    const handleExport = async () => {
        setIsLoading(true);
        try {
            const body = exportType === 'selected' && selectedIds.size > 0
                ? { projectIds: Array.from(selectedIds), parentsOnly: true }
                : { parentsOnly: true };

            const response = await fetch(`${API_URL}/projects-io/export`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Không thể export dự án');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `DuAn_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            onClose();
        } catch (error: any) {
            console.error('Export error:', error);
            alert('Lỗi khi export dự án: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b dark:border-gray-700 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <FileSpreadsheet className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Export Dự Án
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Xuất danh sách dự án cha ra Excel
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                        <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-2">
                            <FileDown className="w-5 h-5" />
                            Xuất dữ liệu dự án ra file Excel
                        </h3>
                        <p className="text-blue-600 dark:text-blue-400 text-sm">
                            File xuất sẽ bao gồm danh sách các <strong>dự án cha</strong> với thông tin đầy đủ.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Chọn dự án để export:
                        </label>
                        <div className="space-y-2">
                            {/* All projects option */}
                            <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${exportType === 'all'
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                }`}>
                                <input
                                    type="radio"
                                    name="exportType"
                                    value="all"
                                    checked={exportType === 'all'}
                                    onChange={() => setExportType('all')}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <div className="flex-1">
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        Tất cả dự án cha ({projects.length})
                                    </span>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Export toàn bộ dự án cha trong hệ thống
                                    </p>
                                </div>
                            </label>

                            {/* Selected projects option */}
                            <div className={`rounded-xl border-2 transition-all ${exportType === 'selected'
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                }`}>
                                <label className="flex items-center gap-3 p-4 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="exportType"
                                        value="selected"
                                        checked={exportType === 'selected'}
                                        onChange={() => setExportType('selected')}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <div className="flex-1">
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            Chọn từng dự án ({selectedIds.size})
                                        </span>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {selectedIds.size === 0
                                                ? 'Nhấn để chọn dự án cụ thể'
                                                : `Đã chọn ${selectedIds.size} dự án`
                                            }
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setExportType('selected');
                                            setShowProjectList(!showProjectList);
                                        }}
                                        className="p-1 hover:bg-blue-100 rounded-lg transition-colors"
                                    >
                                        {showProjectList ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </button>
                                </label>

                                {/* Project selection list */}
                                {exportType === 'selected' && showProjectList && (
                                    <div className="border-t border-gray-200 dark:border-gray-700">
                                        {/* Select/Deselect all */}
                                        <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 flex items-center justify-between">
                                            <span className="text-sm text-gray-600 dark:text-gray-300">
                                                {selectedIds.size}/{projects.length} đã chọn
                                            </span>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={selectAll}
                                                    className="text-xs text-blue-600 hover:underline"
                                                >
                                                    Chọn tất cả
                                                </button>
                                                <span className="text-gray-400">|</span>
                                                <button
                                                    type="button"
                                                    onClick={deselectAll}
                                                    className="text-xs text-gray-600 hover:underline"
                                                >
                                                    Bỏ chọn
                                                </button>
                                            </div>
                                        </div>

                                        {/* Project list */}
                                        <div className="max-h-48 overflow-y-auto">
                                            {isLoadingProjects ? (
                                                <div className="p-4 text-center text-gray-500">
                                                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                                    Đang tải...
                                                </div>
                                            ) : projects.length === 0 ? (
                                                <div className="p-4 text-center text-gray-500">
                                                    Không có dự án nào
                                                </div>
                                            ) : (
                                                projects.map(project => (
                                                    <label
                                                        key={project.id}
                                                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                                    >
                                                        <div
                                                            onClick={() => toggleProject(project.id)}
                                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${selectedIds.has(project.id)
                                                                    ? 'bg-blue-500 border-blue-500'
                                                                    : 'border-gray-300 hover:border-blue-400'
                                                                }`}
                                                        >
                                                            {selectedIds.has(project.id) && (
                                                                <Check size={14} className="text-white" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                                                {project.name}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                {project.code}
                                                                {project.children && project.children.length > 0 && (
                                                                    <span className="ml-2 text-blue-500">
                                                                        ({project.children.length} dự án con)
                                                                    </span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleExport}
                        disabled={isLoading || (exportType === 'selected' && selectedIds.size === 0)}
                        className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/25"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Đang xuất...
                            </>
                        ) : (
                            <>
                                <Download className="w-5 h-5" />
                                Xuất File Excel
                                {exportType === 'selected' && selectedIds.size > 0 && (
                                    <span className="ml-1">({selectedIds.size} dự án)</span>
                                )}
                            </>
                        )}
                    </button>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                        <span>
                            💡 Chỉ export các dự án cha (level 1)
                        </span>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectExport;
