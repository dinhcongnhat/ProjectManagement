import { useState } from 'react';
import { CheckCircle2, Clock, Circle, Send, Loader2, AlertCircle, Check } from 'lucide-react';
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

export const ProjectWorkflow = ({
    projectId,
    workflow,
    isManager,
    isImplementer: _isImplementer,
    isAdmin,
    token,
    onRefresh
}: ProjectWorkflowProps) => {
    const { showConfirm, showSuccess, showError } = useDialog();
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Determines if a user has managerial rights (Admin, Manager, or potentially Creator if passed, assuming isManager covers it for now)
    const canApprove = isAdmin || isManager;

    const handleAction = async (action: string, endpoint: string, confirmMsg: string) => {
        const confirmed = await showConfirm(confirmMsg);
        if (!confirmed) return;

        setActionLoading(action);
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
            setActionLoading(null);
        }
    };

    // Calculate overall progress percentage
    const calculateProgress = () => {
        if (workflow?.sentToCustomerAt) return 100;
        if (workflow?.completedApprovedAt) return 75;
        if (workflow?.inProgressConfirmedAt) return 50;
        if (workflow?.receivedConfirmedAt) return 25;
        return 0;
    };

    const overallProgress = calculateProgress();

    const steps = [
        {
            id: 'received',
            title: 'Đã nhận thông tin',
            percentage: 25,
            isCompleted: !!workflow?.receivedConfirmedAt,
            canToggle: !workflow?.receivedConfirmedAt, // Can only toggle if not done
            action: () => handleAction('received', 'confirm-received', 'Xác nhận chuyển sang Đang thực hiện?'),
            description: workflow?.receivedConfirmedAt ? `Hoàn tất: ${new Date(workflow.receivedConfirmedAt).toLocaleDateString()}` : 'Xác nhận để bắt đầu thực hiện',
            icon: Circle
        },
        {
            id: 'in_progress',
            title: 'Đang thực hiện',
            percentage: 50,
            isCompleted: !!workflow?.inProgressConfirmedAt,
            // Can toggle if previous step is done AND this step is not done
            canToggle: !!workflow?.receivedConfirmedAt && !workflow?.inProgressConfirmedAt,
            action: () => handleAction('in_progress', 'confirm-in-progress', 'Xác nhận công việc đã hoàn thành?'),
            description: workflow?.inProgressConfirmedAt ? `Hoàn tất: ${new Date(workflow.inProgressConfirmedAt).toLocaleDateString()}` : 'Xác nhận khi hoàn thành công việc',
            icon: Clock
        },
        {
            id: 'completed_approval',
            title: 'Duyệt hoàn thành',
            percentage: 75,
            isCompleted: !!workflow?.completedApprovedAt,
            // Special case: "Toggle" here means Approval.
            // Visible/Active if In Progress is done (worker confirmed) AND not yet approved.
            // AND user has permission.
            isApprovalStep: true, // Marker for custom rendering
            canToggle: !!workflow?.inProgressConfirmedAt && !workflow?.completedApprovedAt && canApprove,
            action: () => handleAction('approve', 'approve-completed', 'Xác nhận duyệt hoàn thành dự án?'),
            description: workflow?.completedApprovedAt
                ? `Đã duyệt bởi ${workflow.completedApprovedBy?.name} lúc ${new Date(workflow.completedApprovedAt).toLocaleString()}`
                : (workflow?.inProgressConfirmedAt ? 'Chờ quản lý duyệt' : 'Chưa hoàn thành công việc'),
            icon: CheckCircle2
        },
        {
            id: 'sent_customer',
            title: 'Đã gửi khách hàng',
            percentage: 100,
            isCompleted: !!workflow?.sentToCustomerAt,
            // Can toggle if Approved AND not yet sent
            canToggle: !!workflow?.completedApprovedAt && !workflow?.sentToCustomerAt,
            action: () => handleAction('sent', 'confirm-sent-to-customer', 'Xác nhận đã gửi kết quả cho khách hàng?'),
            description: workflow?.sentToCustomerAt ? `Đã gửi: ${new Date(workflow.sentToCustomerAt).toLocaleDateString()}` : 'Xác nhận sau khi gửi kết quả',
            icon: Send
        }
    ];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <AlertCircle size={20} className="text-blue-600" />
                    Tiến độ dự án
                </h3>
                <div className="flex items-center gap-3">
                    <span className={`text-2xl font-bold ${overallProgress === 100 ? 'text-green-600' : 'text-blue-600'}`}>
                        {overallProgress}%
                    </span>
                </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="mb-6">
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${overallProgress === 100
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                            }`}
                        style={{ width: `${overallProgress}%` }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                </div>
            </div>

            <div className="flex flex-col gap-0 relative">
                {/* Vertical Line Connector */}
                <div className="absolute left-[19px] top-4 bottom-8 w-0.5 bg-gray-100 z-0" />

                {steps.map((step, index) => {
                    const isLast = index === steps.length - 1;
                    const isLoading = actionLoading === step.id || (step.id === 'completed_approval' && actionLoading === 'approve');
                    const isActive = step.canToggle;
                    const isDone = step.isCompleted;

                    return (
                        <div key={step.id} className={`relative z-10 flex gap-4 ${!isLast ? 'pb-8' : ''}`}>
                            {/* Checkbox / Icon Area */}
                            <div className="flex-shrink-0 pt-1">
                                <button
                                    onClick={isActive ? step.action : undefined}
                                    disabled={!isActive || isLoading}
                                    className={`
                                        w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200
                                        ${isDone
                                            ? 'bg-green-500 border-green-500 text-white'
                                            : isActive
                                                ? 'bg-white border-blue-500 text-blue-500 hover:bg-blue-50 cursor-pointer shadow-sm'
                                                : 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                                        }
                                    `}
                                >
                                    {isLoading ? (
                                        <Loader2 size={20} className="animate-spin" />
                                    ) : isDone ? (
                                        <Check size={20} strokeWidth={3} />
                                    ) : (
                                        <step.icon size={20} />
                                    )}
                                </button>
                            </div>

                            {/* Content Area */}
                            <div className="flex-grow pt-2">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className={`text-base font-semibold ${isDone ? 'text-gray-900' : isActive ? 'text-blue-900' : 'text-gray-500'}`}>
                                            {step.title}
                                        </h4>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDone
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-500'
                                            }`}>
                                            {step.percentage}%
                                        </span>
                                    </div>
                                    {step.isApprovalStep && !isDone && !!workflow?.inProgressConfirmedAt && !canApprove && (
                                        <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full font-medium">
                                            Chờ duyệt
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500">
                                    {step.description}
                                </p>

                                {/* Explicit Action Button for Approval if needed, though the circle click handles it */}
                                {step.isApprovalStep && isActive && (
                                    <button
                                        onClick={step.action}
                                        disabled={isLoading}
                                        className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
                                    >
                                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                        Duyệt dự án ngay
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ProjectWorkflow;
