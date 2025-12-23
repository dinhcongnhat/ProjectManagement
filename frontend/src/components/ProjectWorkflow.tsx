import { useState } from 'react';
import { CheckCircle2, Clock, Circle, Send, Loader2, AlertCircle } from 'lucide-react';
import { API_URL } from '../config/api';
import { useDialog } from './ui/Dialog';

interface WorkflowData {
    id: number;
    projectId: number;
    currentStatus: 'RECEIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'SENT_TO_CUSTOMER';
    receivedStartAt: string | null;
    receivedConfirmedAt: string | null;
    inProgressStartAt: string | null;
    inProgressConfirmedAt: string | null;
    completedStartAt: string | null;
    completedConfirmedAt: string | null;
    completedApprovedAt: string | null;
    completedApprovedBy: { id: number; name: string } | null;
    sentToCustomerAt: string | null;
}

interface ProjectWorkflowProps {
    projectId: number;
    workflow: WorkflowData | null;
    isManager: boolean;
    isImplementer: boolean;
    isAdmin: boolean;
    token: string;
    onRefresh: () => void;
}

const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const ProjectWorkflow = ({
    projectId,
    workflow,
    isManager,
    isImplementer,
    isAdmin,
    token,
    onRefresh
}: ProjectWorkflowProps) => {
    const [loading, setLoading] = useState<string | null>(null);
    const { showConfirm, showSuccess, showError } = useDialog();

    const currentStep = workflow ?
        workflow.currentStatus === 'RECEIVED' ? 1 :
            workflow.currentStatus === 'IN_PROGRESS' ? 2 :
                workflow.currentStatus === 'COMPLETED' ? 3 : 4 : 1;

    const handleAction = async (action: string, endpoint: string, confirmMessage: string) => {
        const confirmed = await showConfirm(confirmMessage);
        if (!confirmed) return;

        setLoading(action);
        try {
            const response = await fetch(`${API_URL}/projects/${projectId}/workflow/${endpoint}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                showSuccess('Cập nhật trạng thái thành công!');
                onRefresh();
            } else {
                const error = await response.json();
                showError(error.message || 'Có lỗi xảy ra');
            }
        } catch (error) {
            console.error('Error updating workflow:', error);
            showError('Có lỗi xảy ra khi cập nhật trạng thái');
        } finally {
            setLoading(null);
        }
    };

    // Xác định quyền cho từng action
    const canConfirmReceived = (isImplementer || isManager || isAdmin) && currentStep === 1;
    const canConfirmInProgress = (isImplementer || isManager || isAdmin) && currentStep === 2;
    const canApproveCompleted = (isManager || isAdmin) && currentStep === 3 && !workflow?.completedApprovedAt;
    const canSendToCustomer = (isImplementer || isManager || isAdmin) && currentStep === 3 && workflow?.completedApprovedAt;

    // Define workflow steps
    const steps = [
        {
            id: 1,
            name: 'Đã nhận thông tin',
            description: 'Xác nhận đã nhận thông tin dự án',
            isCompleted: currentStep > 1,
            isCurrent: currentStep === 1,
            completedAt: workflow?.receivedConfirmedAt,
            canToggle: canConfirmReceived,
            onToggle: () => handleAction('confirm-received', 'confirm-received', 'Xác nhận đã nhận thông tin dự án?'),
            icon: Circle
        },
        {
            id: 2,
            name: 'Đang thực hiện',
            description: 'Đang thực hiện công việc',
            isCompleted: currentStep > 2,
            isCurrent: currentStep === 2,
            completedAt: workflow?.inProgressConfirmedAt,
            canToggle: canConfirmInProgress,
            onToggle: () => handleAction('confirm-in-progress', 'confirm-in-progress', 'Xác nhận đã hoàn thành công việc?'),
            icon: Clock
        },
        {
            id: 3,
            name: 'Đã hoàn thành',
            description: workflow?.completedApprovedAt
                ? `PM duyệt: ${workflow.completedApprovedBy?.name || 'N/A'}`
                : 'Chờ PM duyệt',
            isCompleted: currentStep > 3,
            isCurrent: currentStep === 3,
            completedAt: workflow?.completedConfirmedAt,
            approvedAt: workflow?.completedApprovedAt,
            canToggle: canApproveCompleted,
            onToggle: () => handleAction('approve-completed', 'approve-completed', 'Duyệt xác nhận hoàn thành dự án?'),
            canSendToCustomer,
            sendToCustomerAction: () => handleAction('send-to-customer', 'confirm-sent-to-customer', 'Xác nhận đã gửi kết quả cho khách hàng?'),
            icon: CheckCircle2
        },
        {
            id: 4,
            name: 'Đã gửi khách hàng',
            description: 'Kết quả đã được gửi cho khách hàng',
            isCompleted: currentStep >= 4,
            isCurrent: false,
            completedAt: workflow?.sentToCustomerAt,
            canToggle: false,
            onToggle: () => { },
            icon: Send
        }
    ];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <AlertCircle size={20} className="text-blue-600" />
                Tiến trình công việc
            </h3>

            <div className="space-y-3">
                {steps.map((step, index) => {
                    const StepIcon = step.icon;
                    const isLoading = loading !== null;

                    return (
                        <div
                            key={step.id}
                            className={`
                                relative flex items-center gap-4 p-4 rounded-xl transition-all
                                ${step.isCompleted
                                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'
                                    : step.isCurrent
                                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200'
                                        : 'bg-gray-50 border border-gray-200'
                                }
                            `}
                        >
                            {/* Checkbox / Status indicator */}
                            <div className="flex-shrink-0">
                                {step.canToggle ? (
                                    <button
                                        onClick={step.onToggle}
                                        disabled={isLoading}
                                        className={`
                                            w-8 h-8 rounded-lg border-2 flex items-center justify-center
                                            transition-all cursor-pointer
                                            ${step.isCompleted
                                                ? 'bg-green-500 border-green-500 text-white'
                                                : 'bg-white border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                                            }
                                            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                                        `}
                                        title={step.isCompleted ? 'Đã hoàn thành' : 'Nhấn để xác nhận'}
                                    >
                                        {isLoading && loading?.includes(step.name.toLowerCase()) ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : step.isCompleted ? (
                                            <CheckCircle2 size={18} />
                                        ) : null}
                                    </button>
                                ) : (
                                    <div
                                        className={`
                                            w-8 h-8 rounded-lg flex items-center justify-center
                                            ${step.isCompleted
                                                ? 'bg-green-500 text-white'
                                                : step.isCurrent
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-gray-300 text-gray-500'
                                            }
                                        `}
                                    >
                                        {step.isCompleted ? (
                                            <CheckCircle2 size={18} />
                                        ) : (
                                            <StepIcon size={18} />
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className={`font-semibold ${step.isCompleted ? 'text-green-700' :
                                            step.isCurrent ? 'text-blue-700' : 'text-gray-500'
                                        }`}>
                                        {step.name}
                                    </h4>
                                    {step.isCurrent && (
                                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full">
                                            Hiện tại
                                        </span>
                                    )}
                                </div>

                                <p className="text-sm text-gray-500 mt-0.5">{step.description}</p>

                                {step.completedAt && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        Hoàn thành: {formatDateTime(step.completedAt)}
                                    </p>
                                )}
                            </div>

                            {/* Send to customer button */}
                            {step.canSendToCustomer && (
                                <button
                                    onClick={step.sendToCustomerAction}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
                                >
                                    {loading === 'send-to-customer' ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <Send size={16} />
                                    )}
                                    Gửi khách hàng
                                </button>
                            )}

                            {/* Connector line */}
                            {index < steps.length - 1 && (
                                <div className={`
                                    absolute left-8 top-full w-0.5 h-3 -translate-x-1/2 z-10
                                    ${step.isCompleted ? 'bg-green-400' : 'bg-gray-200'}
                                `} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ProjectWorkflow;
