import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { HomeDashboard } from './components/HomeDashboard';
import { ClassroomManager } from './components/ClassroomManager';
import { ReportsSection } from './components/ReportsSection';
import { QuizBank } from './components/QuizBank';
import { DigitalResources } from './components/DigitalResources';
import { GamesSection } from './components/GamesSection';
import { UtilitiesSection } from './components/UtilitiesSection';
import { AdminPanel } from './components/AdminPanel';
import { RoomCodeModal } from './components/RoomCodeModal';
import { RandomPickerModal } from './components/RandomPickerModal';
import { DownloadGuideModal } from './components/DownloadGuideModal';
import { LoginModal } from './components/LoginModal';
import { StudentPortal } from './components/StudentPortal';
import { FirstLoginChangePasswordModal } from './components/FirstLoginChangePasswordModal';
import { DataBackupModal } from './components/DataBackupModal';
import {
  INITIAL_CLASSROOMS,
  INITIAL_STUDENTS,
  INITIAL_RESOURCES,
  INITIAL_PERMISSIONS,
} from './data/mockData';
import {
  ActiveTab,
  Classroom,
  DigitalResource,
  Student,
  StudentPermissions,
  UserAccount,
} from './types';
import { soundManager } from './utils/audio';
import confetti from 'canvas-confetti';
import { restoreSession, signOut } from './services/authService';
import { listMyClasses } from './services/classesService';
import { listStudentsByClass } from './services/studentsService';

const GUEST_ACCOUNT: UserAccount = {
  id: '',
  username: '',
  fullName: 'Khách',
  role: 'student',
  status: 'active',
  createdAt: new Date().toISOString(),
};

export default function App() {
  // Main view mode: 'portal' (Student Hub) or 'teacher' (Teacher workspace).
  // Chỉ chuyển sang 'teacher' sau khi xác nhận có phiên đăng nhập thật (xem useEffect khôi phục phiên).
  const [viewMode, setViewMode] = useState<'portal' | 'teacher'>(() => {
    try {
      const savedMode = localStorage.getItem('qllh_view_mode');
      if (savedMode === 'teacher' || savedMode === 'portal') return savedMode;
    } catch {}
    return 'portal';
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    try {
      const savedTab = localStorage.getItem('qllh_active_tab') as ActiveTab;
      if (savedTab) return savedTab;
    } catch {}
    return 'home';
  });
  const [roomCode, setRoomCode] = useState('F08AF1');
  const [selectedYear, setSelectedYear] = useState(() => {
    return localStorage.getItem('qllh_current_year') || '';
  });
  const [targetSubTab, setTargetSubTab] = useState<'week' | 'student' | 'grade'>('week');


  // Accounts & RBAC Authentication State
  const [accounts, setAccounts] = useState<UserAccount[]>([]);

  // currentUser chỉ được set thật sau khi xác nhận có phiên đăng nhập Supabase hợp lệ
  // (xem useEffect khôi phục phiên bên dưới). Mặc định luôn là Khách (chưa đăng nhập).
  const [currentUser, setCurrentUser] = useState<UserAccount>(GUEST_ACCOUNT);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Khôi phục phiên đăng nhập thật khi vừa mở trang (không tin localStorage, luôn hỏi lại Supabase)
  useEffect(() => {
    let isMounted = true;
    restoreSession()
      .then((profile) => {
        if (!isMounted) return;
        if (profile) {
          setCurrentUser(profile);
          setViewMode('teacher');
        } else {
          setCurrentUser(GUEST_ACCOUNT);
          setViewMode('portal');
        }
      })
      .finally(() => {
        if (isMounted) setIsAuthChecking(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const teacherName = currentUser?.fullName || 'Thầy giáo viên';

  const [permissions, setPermissions] = useState<StudentPermissions>(() => {
    const saved = localStorage.getItem('qllh_student_permissions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return INITIAL_PERMISSIONS;
  });

  const isAdmin = currentUser.role === 'admin';

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('qllh_user_accounts', JSON.stringify(accounts));
  }, [accounts]);

  // Lắng nghe sự kiện cập nhật tài khoản từ đám mây
  useEffect(() => {
    const handleAccountsSync = (e: any) => {
      if (e.detail?.accounts && Array.isArray(e.detail.accounts) && e.detail.accounts.length > 0) {
        // Chỉ cập nhật state nếu dữ liệu thực sự khác biệt
        setAccounts((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(e.detail.accounts)) return prev;
          return e.detail.accounts;
        });
      }
    };
    window.addEventListener('qllh_accounts_updated', handleAccountsSync);
    return () => window.removeEventListener('qllh_accounts_updated', handleAccountsSync);
  }, []);

  useEffect(() => {
    localStorage.setItem('qllh_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('qllh_active_tab', activeTab);
    // Luôn cuộn về đầu trang khi chuyển mục: tránh các nút/tab con (vd: "Quản lý tài khoản" trong
    // Quản trị & Phân quyền) bị thanh header dính (sticky) ở trên che mất và không bấm được trên màn hình nhỏ.
    window.scrollTo(0, 0);
  }, [activeTab]);

  const [isCloudConnected, setIsCloudConnected] = useState(true);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  const [syncToast, setSyncToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });

  // Hành động chủ động bấm đồng bộ đám mây bằng tay (Manual Sync)
  const handleManualSyncCloud = async () => {
    setIsSyncingCloud(true);
    try {
      const cls = await listMyClasses();
      setClassrooms(cls);
      setSyncToast({
        show: true,
        message: 'Đã đồng bộ thành công dữ liệu từ máy chủ Supabase!',
        type: 'success',
      });
      setTimeout(() => setSyncToast({ show: false, message: '', type: 'success' }), 3000);
    } catch {
      setSyncToast({
        show: true,
        message: 'Lỗi khi đồng bộ dữ liệu đám mây!',
        type: 'error',
      });
      setTimeout(() => setSyncToast({ show: false, message: '', type: 'error' }), 3000);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Core application data state theo tài khoản người dùng
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    const loadClasses = async () => {
      try {
        const cls = await listMyClasses();
        setClassrooms(cls);
        if (cls.length > 0 && !selectedClassId) {
          setSelectedClassId(cls[0].id);
        }
      } catch (err) {
        console.error('Lỗi tải lớp học trong App:', err);
      }
    };
    loadClasses();
    window.addEventListener('qllh_data_updated', loadClasses);
    return () => window.removeEventListener('qllh_data_updated', loadClasses);
  }, [currentUser?.id]);

  const [resources, setResources] = useState<DigitalResource[]>(() => {
    try {
      const saved = localStorage.getItem('qllh_digital_resources');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_RESOURCES;
  });

  useEffect(() => {
    localStorage.setItem('qllh_digital_resources', JSON.stringify(resources));
  }, [resources]);

  // Lắng nghe cập nhật trắc nghiệm, học liệu số, phân quyền từ các component con và đám mây
  useEffect(() => {
    const handleGlobalDataSync = (e: any) => {
      const d = e?.detail?.data;
      if (d) {
        if (d.resources && Array.isArray(d.resources) && d.resources.length > 0) {
          setResources((prev) => (JSON.stringify(prev) === JSON.stringify(d.resources) ? prev : d.resources));
        }
        if (d.permissions) {
          setPermissions((prev: StudentPermissions) => (JSON.stringify(prev) === JSON.stringify(d.permissions) ? prev : d.permissions));
        }
      }
    };
    window.addEventListener('qllh_data_updated', handleGlobalDataSync);
    return () => window.removeEventListener('qllh_data_updated', handleGlobalDataSync);
  }, []);

  // Modals
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isRandomPickerOpen, setIsRandomPickerOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [classroomActionTrigger, setClassroomActionTrigger] = useState<{
    action: 'edit_class' | 'delete_class' | 'delete_year';
    classId?: string;
    year?: string;
    timestamp: number;
  } | null>(null);


  // Role-based access control
  useEffect(() => {
    // Only 'admin' can access admin tab (Quản trị viên tối cao)
    if (currentUser.role !== 'admin' && activeTab === 'admin') {
      setActiveTab('home');
      return;
    }
    // Teacher restrictions according to permissions matrix
    if (currentUser.role === 'teacher') {
      if (activeTab === 'classroom' && !permissions.canViewClassroom) {
        setActiveTab('home');
      } else if (activeTab === 'quiz' && !permissions.canViewQuiz) {
        setActiveTab('home');
      } else if (activeTab === 'resources' && !permissions.canViewResources) {
        setActiveTab('home');
      } else if (activeTab === 'games' && !permissions.canViewGames) {
        setActiveTab('home');
      } else if (activeTab === 'utilities' && !permissions.canViewUtilities) {
        setActiveTab('home');
      }
    }
  }, [activeTab, currentUser.role, permissions]);

  const handleUserLogin = (user: UserAccount) => {
    setCurrentUser(user);
    listMyClasses()
      .then((cls) => {
        setClassrooms(cls);
        if (cls.length > 0) {
          setSelectedClassId(cls[0].id);
        }
      })
      .catch(() => {});

    window.dispatchEvent(new Event('qllh_data_updated'));

    if (user.role === 'admin' || user.role === 'teacher') {
      setViewMode('teacher');
      soundManager.playFanfare();
    } else {
      setViewMode('portal');
    }
  };

  const handlePasswordChangedOnFirstLogin = (newPassword: string) => {
    setAccounts((prev) => {
      const updated = prev.map((a) =>
        a.id === currentUser.id ? { ...a, password: newPassword, mustChangePassword: false } : a
      );
      localStorage.setItem('qllh_user_accounts', JSON.stringify(updated));
      return updated;
    });

    setCurrentUser((prev) => ({
      ...prev,
      password: newPassword,
      mustChangePassword: false,
    }));
  };

  const handleRegenerateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let newCode = '';
    for (let i = 0; i < 6; i++) {
      newCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRoomCode(newCode);
    soundManager.playStarSound();
  };

  const handleRewardStudentFromPicker = (studentId: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === studentId) {
          return { ...s, stars: s.stars + 1, speeches: s.speeches + 1 };
        }
        return s;
      })
    );
    soundManager.playStarSound();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
    });
  };

  const handleLogout = () => {
    signOut().finally(() => {
      localStorage.setItem('qllh_view_mode', 'portal');
      setCurrentUser(GUEST_ACCOUNT);
      setViewMode('portal');
      setIsLoginModalOpen(true);
      setIsMobileSidebarOpen(false);
    });
  };

  // Màn hình chờ trong lúc kiểm tra phiên đăng nhập thật với Supabase (tránh lộ giao diện Admin trước khi xác thực xong)
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col items-center justify-center p-6 antialiased">
        <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-blue-100 flex flex-col items-center max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 mb-4 animate-bounce">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight mb-1">QLLH.Pro</h2>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-3 inline-block">
            Đang kiểm tra đăng nhập
          </span>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Đang xác thực phiên đăng nhập với máy chủ Supabase...
          </p>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-5 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 via-indigo-600 to-sky-500 h-full rounded-full animate-pulse w-full" />
          </div>
        </div>
      </div>
    );
  }

  // If in Portal mode (Landing Image 1 / Student Hub Image 2)
  if (viewMode === 'portal') {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col antialiased">
        <StudentPortal
          roomCode={roomCode}
          teacherUsername={currentUser.role === 'admin' || currentUser.role === 'teacher' ? currentUser.username : 'trungkienkd2025'}
          classrooms={classrooms}
          resources={resources}
          onOpenTeacherLogin={() => setIsLoginModalOpen(true)}
        />

        {/* User Login Modal */}
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          accounts={accounts}
          currentUser={currentUser}
          onLoginSuccess={handleUserLogin}
        />

        {/* Mandatory First-Login Password Change Modal */}
        {currentUser.mustChangePassword && (
          <FirstLoginChangePasswordModal
            currentUser={currentUser}
            onPasswordChanged={handlePasswordChangedOnFirstLogin}
          />
        )}
      </div>
    );
  }

  // Teacher Workspace
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col antialiased">
      {/* Mobile Top Header */}

      <Header
        onToggleSidebar={() => setIsMobileSidebarOpen(true)}
        roomCode={roomCode}
        onOpenRoomModal={() => setIsRoomModalOpen(true)}
        teacherName={teacherName}
        onOpenDownloadGuide={() => setIsDownloadModalOpen(true)}
        currentUser={currentUser}
        isAdmin={isAdmin}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        onSwitchToStudentPortal={() => setViewMode('portal')}
        isCloudConnected={isCloudConnected}
        isSyncingCloud={isSyncingCloud}
        onManualSyncCloud={handleManualSyncCloud}
      />

      <div className="flex-1 flex">
        {/* Left Navigation Sidebar (Desktop sticky & Mobile drawer) */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          roomCode={roomCode}
          onOpenRoomModal={() => setIsRoomModalOpen(true)}
          isMobileOpen={isMobileSidebarOpen}
          setIsMobileOpen={setIsMobileSidebarOpen}
          teacherName={teacherName}
          username={currentUser.username}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          onOpenDownloadGuide={() => setIsDownloadModalOpen(true)}
          currentUser={currentUser}
          isAdmin={isAdmin}
          permissions={permissions}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onLogout={handleLogout}
          selectedClassId={selectedClassId || undefined}
          onSelectClass={(classId, sub) => {
            setSelectedClassId(classId || null);
            if (sub) setTargetSubTab(sub);
          }}
          targetSubTab={targetSubTab}
          onSwitchToStudentPortal={() => setViewMode('portal')}
          onEditClass={(classId) => {
            setSelectedClassId(classId);
            setClassroomActionTrigger({ action: 'edit_class', classId, timestamp: Date.now() });
            setActiveTab('classroom');
          }}
          onDeleteClass={(classId) => {
            setSelectedClassId(classId);
            setClassroomActionTrigger({ action: 'delete_class', classId, timestamp: Date.now() });
            setActiveTab('classroom');
          }}
          onDeleteYear={(year) => {
            setClassroomActionTrigger({ action: 'delete_year', year, timestamp: Date.now() });
            setActiveTab('classroom');
          }}
          onOpenBackup={() => setIsBackupModalOpen(true)}
          isCloudConnected={isCloudConnected}
          isSyncingCloud={isSyncingCloud}
          onManualSyncCloud={handleManualSyncCloud}
        />

        {/* Main Content Area */}
        <main className="flex-1 lg:pl-[260px] p-4 sm:p-6 lg:p-10 transition-all flex flex-col justify-between">
          <div className="w-full">
            {/* Quick banner with Cloud & Backup Status */}
            <div className="mb-4 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold bg-white/20 px-2 py-0.5 rounded-md uppercase tracking-wider text-[11px]">
                  Mã lớp: {roomCode}
                </span>
                <span className="hidden md:inline">
                  Học sinh truy cập trang web và nhập mã <strong>{roomCode}</strong>.
                </span>
                <button
                  type="button"
                  onClick={handleManualSyncCloud}
                  disabled={isSyncingCloud}
                  className="inline-flex items-center gap-1.5 bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-100 text-[11px] font-bold px-2.5 py-1 rounded-md border border-emerald-400/40 cursor-pointer transition active:scale-95 disabled:opacity-60"
                  title="Bấm để đồng bộ dữ liệu ngay lập tức với đám mây Supabase"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                  <span>{isSyncingCloud ? 'Đang đồng bộ...' : '☁️ CSDL Đám mây: Đồng bộ mọi máy'}</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBackupModalOpen(true)}
                  className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl transition-all shadow-2xs shrink-0 cursor-pointer flex items-center gap-1.5 border border-white/25 active:scale-95"
                  title="Sao lưu toàn bộ học sinh, điểm số ra file .json hoặc đám mây"
                >
                  <span>💾 Sao lưu & Bảo vệ CSDL</span>
                </button>
                <button
                  onClick={() => setViewMode('portal')}
                  className="px-3 py-1 bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold rounded-xl transition-all shadow-2xs shrink-0 cursor-pointer"
                >
                  👁️ Xem Cổng Học sinh
                </button>
              </div>
            </div>

            {activeTab === 'home' && (
              <HomeDashboard
                onSelectTab={(tab) => {
                  if (tab === 'classroom') {
                    setSelectedClassId(null);
                  }
                  setActiveTab(tab);
                }}
                roomCode={roomCode}
                onOpenRoomModal={() => setIsRoomModalOpen(true)}
                teacherName={teacherName}
                onOpenDownloadGuide={() => setIsDownloadModalOpen(true)}
                currentUser={currentUser}
                isAdmin={isAdmin}
                permissions={permissions}
                onOpenLogin={() => setIsLoginModalOpen(true)}
                onSwitchToStudentPortal={() => setViewMode('portal')}
              />
            )}

            {activeTab === 'classroom' && (
              <ClassroomManager
                onBackToHome={() => {
                  setSelectedClassId(null);
                  setActiveTab('home');
                }}
                onOpenRandomPicker={() => setIsRandomPickerOpen(true)}
                isAdmin={isAdmin}
                currentUser={currentUser}
                selectedClassIdExternal={selectedClassId || undefined}
                onSelectClassExternal={(id) => setSelectedClassId(id || null)}
                targetSubTab={targetSubTab}
                actionTrigger={classroomActionTrigger}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsSection isAdmin={isAdmin} currentUser={currentUser} />
            )}

            {activeTab === 'quiz' && (
              <QuizBank isAdmin={isAdmin || currentUser?.role === 'teacher'} />
            )}

            {activeTab === 'resources' && (
              <DigitalResources resources={resources} setResources={setResources} isAdmin={isAdmin || currentUser?.role === 'teacher'} />
            )}

            {activeTab === 'games' && <GamesSection />}

            {activeTab === 'utilities' && (
              <UtilitiesSection
                classrooms={classrooms}
                selectedClassId={selectedClassId || 'c1'}
                students={students}
                setStudents={setStudents}
                isAdmin={isAdmin}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'admin' && isAdmin && (
              <AdminPanel
                accounts={accounts}
                setAccounts={setAccounts}
                permissions={permissions}
                setPermissions={setPermissions}
                classrooms={classrooms}
                students={students}
                currentUserId={currentUser.id}
              />
            )}
          </div>

          {/* Simple Clean Footer */}
          <footer className="mt-12 pt-6 border-t border-slate-200/60 text-center text-xs text-slate-400">
            <p>
              QLLH.Pro · Hệ thống Quản lý Lớp học Thông minh cho Giáo viên · Phiên bản phân quyền người dùng và bảo mật
            </p>
          </footer>
        </main>
      </div>

      {/* Room Code & Student QR Modal */}
      <RoomCodeModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        roomCode={roomCode}
        onRegenerateCode={handleRegenerateRoomCode}
        teacherName={teacherName}
      />

      {/* Random Student Wheel Picker Modal */}
      <RandomPickerModal
        isOpen={isRandomPickerOpen}
        onClose={() => setIsRandomPickerOpen(false)}
        students={students.filter((s) => s.classId === selectedClassId)}
        onRewardStudent={handleRewardStudentFromPicker}
      />

      {/* Download & Installation Guide Modal */}
      <DownloadGuideModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />

      {/* User Login & Role Switcher Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        accounts={accounts}
        currentUser={currentUser}
        onLoginSuccess={handleUserLogin}
      />

      {/* Mandatory First-Login Password Change Modal */}
      {currentUser.mustChangePassword && (
        <FirstLoginChangePasswordModal
          currentUser={currentUser}
          onPasswordChanged={handlePasswordChangedOnFirstLogin}
        />
      )}

      {/* Database Backup, Protection & Cloud Sync Modal */}
      <DataBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        currentUser={currentUser}
      />

      {/* Cloud Sync Toast Notification */}
      {syncToast.show && (
        <div className="fixed bottom-5 right-5 z-[200] max-w-md bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-3 backdrop-blur-md transition-all">
          <div
            className={`w-3 h-3 rounded-full shrink-0 ${
              syncToast.type === 'success' ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-rose-400'
            }`}
          />
          <p className="text-xs font-semibold leading-relaxed">{syncToast.message}</p>
        </div>
      )}
    </div>
  );
}
