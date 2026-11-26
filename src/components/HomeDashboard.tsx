import React, { useState } from 'react';
import {
  Users,
  GraduationCap,
  Video,
  Gamepad2,
  Wrench,
  Copy,
  Check,
  QrCode,
  ArrowRight,
  Download,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { ActiveTab, StudentPermissions, UserAccount } from '../types';

interface HomeDashboardProps {
  onSelectTab: (tab: ActiveTab) => void;
  roomCode: string;
  onOpenRoomModal: () => void;
  teacherName: string;
  onOpenDownloadGuide: () => void;
  currentUser?: UserAccount;
  isAdmin?: boolean;
  permissions?: StudentPermissions;
  onOpenLogin?: () => void;
  onSwitchToStudentPortal?: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onSelectTab,
  roomCode,
  onOpenRoomModal,
  teacherName,
  onOpenDownloadGuide,
  currentUser,
  isAdmin = true,
  permissions,
  onOpenLogin,
  onSwitchToStudentPortal,
}) => {
  const [copied, setCopied] = useState(false);
  // Tài khoản nhân sự thật (admin hoặc giáo viên được gán lớp) — khác với học sinh ẩn danh.
  // isAdmin chỉ đúng cho admin, nên không thể dùng riêng nó để phân biệt "nhân viên" và "học sinh".
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'teacher';

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allCards: {
    id: ActiveTab;
    title: string;
    description: string;
    icon: React.ReactNode;
    colorBg: string;
    iconColor: string;
    permissionKey: keyof StudentPermissions;
  }[] = [
    {
      id: 'classroom',
      title: 'Quản lý lớp học',
      description: isStaff
        ? 'Quản lý học sinh, điểm danh, phát biểu và điểm thi đua'
        : 'Xem danh sách thi đua, số sao tích lũy và điểm danh của lớp',
      icon: <Users className="w-6 h-6 text-white" />,
      colorBg: 'bg-[#2563eb]',
      iconColor: 'text-[#2563eb]',
      permissionKey: 'canViewClassroom',
    },
    {
      id: 'quiz',
      title: 'Câu hỏi trắc nghiệm',
      description: isStaff
        ? 'Quản lý ngân hàng câu hỏi trắc nghiệm Tin học'
        : 'Làm bài thi thử trắc nghiệm ôn tập kiến thức Tin học',
      icon: <GraduationCap className="w-6 h-6 text-white" />,
      colorBg: 'bg-[#059669]',
      iconColor: 'text-[#059669]',
      permissionKey: 'canViewQuiz',
    },
    {
      id: 'resources',
      title: 'Học liệu số',
      description: 'Quản lý liên kết video bài giảng theo khối lớp 1-5',
      icon: <Video className="w-6 h-6 text-white" />,
      colorBg: 'bg-[#8b5cf6]',
      iconColor: 'text-[#8b5cf6]',
      permissionKey: 'canViewResources',
    },
    {
      id: 'games',
      title: 'Giải trí',
      description: 'Không gian trò chơi và hoạt động thư giãn cho lớp học',
      icon: <Gamepad2 className="w-6 h-6 text-white" />,
      colorBg: 'bg-[#f59e0b]',
      iconColor: 'text-[#f59e0b]',
      permissionKey: 'canViewGames',
    },
    {
      id: 'utilities',
      title: 'Tiện ích',
      description: 'Thẻ nhận xét học sinh tự động (Excel), đếm ngược thời gian, liên kết tiện ích...',
      icon: <Wrench className="w-6 h-6 text-white" />,
      colorBg: 'bg-[#f43f5e]',
      iconColor: 'text-[#f43f5e]',
      permissionKey: 'canViewUtilities',
    },
  ];

  if (isAdmin) {
    allCards.push({
      id: 'admin',
      title: 'Quản trị & Phân quyền',
      description: 'Tạo tài khoản người dùng, chỉ định quyền xem cho học sinh',
      icon: <ShieldCheck className="w-6 h-6 text-white" />,
      colorBg: 'bg-[#e11d48]',
      iconColor: 'text-[#e11d48]',
      permissionKey: 'canViewUtilities',
    });
  }

  const dashboardCards = allCards.filter(
    (c) => isAdmin || !permissions || permissions[c.permissionKey]
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-7">
      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-slate-500 text-sm font-medium mb-0.5">Xin chào,</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>{isStaff ? teacherName : (currentUser?.fullName || 'Học sinh')}</span>
            {!isStaff && (
              <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                Học sinh
              </span>
            )}
          </h1>
          <p className="text-slate-500 text-sm">
            {isStaff
              ? 'Chọn khu vực cần quản lý để bắt đầu công việc trong lớp.'
              : 'Chào mừng em đến với hệ thống học tập. Dưới đây là các khu vực thầy cô cho phép em truy cập.'}
          </p>
        </div>

        {!isStaff && onOpenLogin && (
          <button
            onClick={onOpenLogin}
            className="self-start sm:self-auto px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-rose-600" />
            <span>Đăng nhập Giáo viên quản trị</span>
          </button>
        )}
      </div>

      {/* Main Room Code Banner */}
      <div className="relative bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden transition-all hover:border-blue-200 group">
        {/* Top Blue Indicator Bar (matches the blue line at top in screenshot) */}
        <div className="h-1 bg-[#2563eb] w-full" />

        <div className="p-4 md:p-5 flex flex-col items-center justify-center text-center relative">
          <span className="text-[#2563eb] font-bold text-[11px] uppercase tracking-wider mb-1.5">
            MÃ PHÒNG HỌC
          </span>

          <div className="flex items-center gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-wider font-mono select-all">
              {roomCode}
            </span>
            <button
              onClick={handleCopyCode}
              className="p-1.5 sm:p-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-slate-500 hover:text-blue-600 transition-colors shadow-2xs"
              title="Sao chép mã phòng"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Grid of Main Management Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {dashboardCards.map((card) => (
          <div
            key={card.id}
            onClick={() => onSelectTab(card.id)}
            className="group bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
          >
            <div>
              {/* Circular Icon */}
              <div
                className={`w-12 h-12 rounded-full ${card.colorBg} flex items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-105`}
              >
                {card.icon}
              </div>

              {/* Title */}
              <h3 className="text-base font-bold text-slate-900 mt-5 group-hover:text-blue-600 transition-colors">
                {card.title}
              </h3>

              {/* Description */}
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                {card.description}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-400 group-hover:text-blue-600 transition-colors">
              <span>Bắt đầu</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
