import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  Sparkles,
  Link2,
  ExternalLink,
  Trash2,
  Pencil,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Classroom, Student, UserAccount } from '../types';
import { soundManager } from '../utils/audio';
import { StudentCommentsManager } from './StudentCommentsManager';
import { Award } from 'lucide-react';
import { SaveLinkForm } from './resources/SaveLinkForm';
import { listResources, deleteResource, updateResource } from '../services/resourcesService';
import { Resource } from '../types';

interface UtilitiesSectionProps {
  classrooms: Classroom[];
  selectedClassId: string;
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  isAdmin?: boolean;
  currentUser?: UserAccount;
}

export const UtilitiesSection: React.FC<UtilitiesSectionProps> = ({
  classrooms,
  selectedClassId,
  students,
  setStudents,
  isAdmin = true,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'comments' | 'timer' | 'links'>(() => {
    try {
      const saved = localStorage.getItem('qllh_utilities_subtab');
      if (saved === 'comments' || saved === 'timer' || saved === 'links') {
        return saved;
      }
    } catch {}
    return 'comments';
  });

  const [utilityLinks, setUtilityLinks] = useState<Resource[]>([]);
  const [editingLink, setEditingLink] = useState<Resource | null>(null);

  const fetchUtilityLinks = async () => {
    try {
      const data = await listResources('link');
      setUtilityLinks(data);
    } catch (e) {
      console.warn('Lỗi tải liên kết tiện ích:', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'links') {
      fetchUtilityLinks();
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem('qllh_utilities_subtab', activeTab);
    } catch {}
  }, [activeTab]);

  // Countdown timer state
  const [timerSeconds, setTimerSeconds] = useState(300); // 5 mins default
  const [initialSeconds, setInitialSeconds] = useState(300);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(5);

  // Luôn có 1 object hợp lệ để render, tránh crash trắng trang khi classrooms chưa tải
  // xong (vd vừa tải lại trang trong khi tab này đang mở) — classrooms rỗng thì [0] vẫn undefined.
  const currentClass = classrooms.find((c) => c.id === selectedClassId) || classrooms[0] || {
    id: '',
    name: 'Đang tải...',
    grade: 1,
    academicYear: '',
    totalStudents: 0,
    roomCode: '',
  };
  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            soundManager.playAlarm();
            setIsTimerRunning(false);
            confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
            return 0;
          }
          if (prev <= 5) {
            soundManager.playTick();
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerSeconds]);

  const handleSetTimer = (secs: number) => {
    setIsTimerRunning(false);
    setTimerSeconds(secs);
    setInitialSeconds(secs);
  };

  const handleCustomMinuteChange = (mins: number) => {
    setCustomMinutes(mins);
    const secs = Math.max(1, mins) * 60;
    setTimerSeconds(secs);
    setInitialSeconds(secs);
  };

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0070F3] bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
              Hộp công cụ tiện ích
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-medium">Hỗ trợ giảng dạy & Đánh giá</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-1">Tiện ích giảng dạy</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Thẻ nhận xét học sinh tự động (Excel), đồng hồ đếm ngược và liên kết tiện ích
          </p>
        </div>

        {/* Tab switchers - Thẻ Nhận xét (Excel) placed first and prominent */}
        <div className="flex items-center flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80">
          <button
            onClick={() => setActiveTab('comments')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'comments'
                ? 'bg-white text-[#0070F3] shadow-sm ring-2 ring-blue-100'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Award className="w-4 h-4 text-[#0070F3]" />
            <span>Thẻ Nhận xét (Excel)</span>
            <span className="text-[10px] bg-blue-100 text-[#0070F3] px-1.5 py-0.5 rounded-full font-black">
              Tự động
            </span>
          </button>
          <button
            onClick={() => setActiveTab('timer')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'timer'
                ? 'bg-white text-rose-600 shadow-sm ring-2 ring-rose-100'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Đồng hồ đếm ngược</span>
          </button>
          <button
            onClick={() => setActiveTab('links')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'links'
                ? 'bg-white text-indigo-600 shadow-sm ring-2 ring-indigo-100'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Liên kết tiện ích</span>
          </button>
        </div>
      </div>

      {/* TAB 1: COUNTDOWN TIMER */}
      {activeTab === 'timer' && (
        <div
          className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xs flex flex-col items-center transition-all bg-gradient-to-br from-indigo-50 via-fuchsia-50 to-amber-50 ${
            isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none p-12 justify-center' : ''
          }`}
        >
          <div className="w-full flex items-center justify-between mb-4">
            <span className="text-xs font-black uppercase tracking-wider bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-500 bg-clip-text text-transparent">
              ĐỒNG HỒ ĐẾM NGƯỢC LỚP HỌC
            </span>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white/70 transition-colors flex items-center gap-1.5 text-xs font-medium"
              title={isFullscreen ? 'Thu nhỏ' : 'Chiếu toàn màn hình lên máy chiếu'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>{isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình chiếu bảng'}</span>
            </button>
          </div>

          {/* Time Display */}
          <div className="my-6 flex flex-col items-center">
            <div
              className={`font-mono font-black tracking-tight select-none drop-shadow-sm ${
                isFullscreen ? 'text-7xl sm:text-9xl' : 'text-6xl sm:text-7xl'
              } ${
                timerSeconds <= 10 && timerSeconds > 0
                  ? 'text-rose-600 animate-pulse'
                  : 'bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent'
              }`}
            >
              {formatTime(timerSeconds)}
            </div>

            {timerSeconds === 0 && (
              <div className="mt-2 text-rose-600 font-bold text-lg animate-bounce">
                Hết giờ làm bài! ⏰
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className={`px-8 py-3.5 rounded-2xl text-white font-bold text-base shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer ${
                isTimerRunning
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                  : 'bg-gradient-to-r from-fuchsia-600 to-rose-600 hover:from-fuchsia-700 hover:to-rose-700'
              }`}
            >
              {isTimerRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
              <span>{isTimerRunning ? 'Tạm dừng' : 'Bắt đầu đếm'}</span>
            </button>

            <button
              onClick={() => {
                setIsTimerRunning(false);
                setTimerSeconds(initialSeconds);
              }}
              className="p-3.5 rounded-2xl bg-white/80 hover:bg-white text-slate-700 transition-colors shadow-2xs border border-slate-200"
              title="Đặt lại thời gian ban đầu"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>

          {/* Preset Buttons */}
          <div className="mt-8 pt-6 border-t border-slate-100 w-full max-w-xl">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider text-center mb-3">
              Thời gian cài đặt nhanh:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { label: '30 Giây', val: 30 },
                { label: '1 Phút', val: 60 },
                { label: '2 Phút', val: 120 },
                { label: '3 Phút', val: 180 },
                { label: '5 Phút', val: 300 },
                { label: '10 Phút', val: 600 },
                { label: '15 Phút', val: 900 },
              ].map((p) => (
                <button
                  key={p.val}
                  onClick={() => handleSetTimer(p.val)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    initialSeconds === p.val && !isTimerRunning
                      ? 'bg-gradient-to-r from-fuchsia-500 to-amber-500 text-white shadow-sm'
                      : 'bg-white/70 text-slate-600 hover:bg-white border border-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-600">
              <span>Hoặc nhập số phút tùy ý:</span>
              <input
                type="number"
                min={1}
                max={120}
                value={customMinutes}
                onChange={(e) => handleCustomMinuteChange(Number(e.target.value))}
                className="w-16 px-2 py-1 text-center font-bold bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
              <span>phút</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STUDENT COMMENTS EXCEL MANAGER */}
      {activeTab === 'comments' && (
        <StudentCommentsManager currentUser={currentUser} />
      )}

      {/* TAB 5: UTILITY LINKS */}
      {activeTab === 'links' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <SaveLinkForm
            key={editingLink?.id || 'new'}
            type="link"
            grade={currentClass?.grade || 1}
            editing={editingLink}
            onSaved={() => {
              setEditingLink(null);
              fetchUtilityLinks();
            }}
            onCancel={editingLink ? () => setEditingLink(null) : undefined}
          />

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Link2 className="w-4 h-4 text-indigo-600" />
              <span>Danh sách liên kết web tiện ích đã lưu</span>
            </h3>

            {utilityLinks.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                Chưa có liên kết tiện ích nào được lưu. Hãy nhập liên kết ở biểu mẫu phía trên.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {utilityLinks.map((link) => (
                  <div
                    key={link.id}
                    className="rounded-2xl border border-slate-200 hover:border-indigo-300 bg-white hover:shadow-xs transition-all flex flex-col justify-between overflow-hidden"
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block relative aspect-video w-full bg-slate-900 overflow-hidden"
                      title="Mở liên kết"
                    >
                      {link.thumbnailUrl ? (
                        <img
                          src={link.thumbnailUrl}
                          alt={link.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-indigo-50">
                          <ExternalLink className="w-6 h-6 text-indigo-400" />
                        </div>
                      )}
                    </a>

                    <div className="p-4">
                      <h4 className="font-bold text-slate-800 text-xs leading-snug line-clamp-2">
                        {link.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 truncate font-mono">
                        {link.url}
                      </p>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center justify-end gap-3 px-4 pb-3 pt-1 border-t border-slate-100">
                        <button
                          onClick={() => setEditingLink(link)}
                          className="text-[11px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Sửa</span>
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Bạn chắc chắn muốn xóa liên kết này?')) {
                              if (editingLink?.id === link.id) setEditingLink(null);
                              await deleteResource(link.id);
                              fetchUtilityLinks();
                            }
                          }}
                          className="text-[11px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
