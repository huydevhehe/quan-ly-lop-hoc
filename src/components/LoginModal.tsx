import React, { useState } from 'react';
import { X, ShieldCheck, User, Key, LogIn, Sparkles, CheckCircle2 } from 'lucide-react';
import { UserAccount } from '../types';
import { soundManager } from '../utils/audio';
import { signInStaff } from '../services/authService';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: UserAccount[];
  currentUser: UserAccount;
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  accounts,
  currentUser,
  onLoginSuccess,
}) => {
  const [loginMode, setLoginMode] = useState<'admin' | 'teacher'>('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const emailToUse = username.includes('@')
        ? username.trim()
        : `${username.trim().toLowerCase()}@qllh.edu.vn`;
      const result = await signInStaff(emailToUse, password);

      if ('error' in result) {
        setErrorMessage(result.error);
        return;
      }

      soundManager.playFanfare();
      onLoginSuccess(result.profile);
      onClose();
      setPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi đăng nhập hệ thống');
    } finally {
      setIsSubmitting(false);
    }
  };

  const adminAcc = accounts.find((a) => a.role === 'admin') || accounts[0];
  const teacherAcc = accounts.find((a) => a.role === 'teacher');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <LogIn className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Đăng nhập tài khoản</h3>
              <p className="text-xs text-slate-500">Quản trị viên · Giáo viên · Học sinh</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current status banner */}
        <div className="px-6 pt-4 pb-2">
          {currentUser.role === 'admin' || currentUser.role === 'teacher' ? (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">Đang đăng nhập với:</span>
              <div className="flex items-center gap-1.5 font-bold">
                <span className="text-sm">{currentUser.avatar || '👤'}</span>
                <span className={currentUser.role === 'admin' ? 'text-rose-600' : 'text-purple-600'}>
                  {currentUser.fullName} ({currentUser.role === 'admin' ? 'Quản trị viên' : 'Giáo viên'})
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200/80 text-xs text-blue-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Vui lòng nhập tài khoản Giáo viên hoặc Quản trị viên để đăng nhập.</span>
            </div>
          )}
        </div>

        {/* Switch tab for admin / teacher */}
        <div className="px-6 pt-2">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold gap-1">
            <button
              type="button"
              onClick={() => {
                setLoginMode('admin');
                setUsername(adminAcc?.username || '');
                setPassword('');
                setErrorMessage('');
              }}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                loginMode === 'admin' ? 'bg-white text-rose-700 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              🛡️ Quản trị viên
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('teacher');
                setUsername(teacherAcc?.username || '');
                setPassword('');
                setErrorMessage('');
              }}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                loginMode === 'teacher' ? 'bg-white text-purple-700 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              👨‍🏫 Giáo viên
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tên đăng nhập
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Mật khẩu
            </label>
            <div className="relative">
              <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            Đăng nhập ngay
          </button>
        </form>
      </div>
    </div>
  );
};
