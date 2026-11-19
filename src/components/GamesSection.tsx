import React, { useState, useRef, useEffect } from 'react';
import {
  Gamepad2,
  Gift,
  RotateCw,
  Sparkles,
  Trophy,
  Music,
  Activity,
  Smile,
  CheckCircle2,
  Volume2,
  Play,
  Trash2,
  Power,
  ExternalLink,
  Plus,
  XCircle,
  Settings,
  Pencil,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PRIZE_WHEEL_ITEMS } from '../data/mockData';
import { soundManager } from '../utils/audio';
import { GameCardForm } from './resources/GameCardForm';
import { listResources, setResourceActive, deleteResource } from '../services/resourcesService';
import { Resource } from '../types';

export const GamesSection: React.FC = () => {
  const [activeGame, setActiveGame] = useState<'wheel' | 'mysteryBox' | 'brainBreak' | 'cards'>('wheel');
  const [customGames, setCustomGames] = useState<Resource[]>([]);
  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [editingGame, setEditingGame] = useState<Resource | null>(null);

  const fetchCustomGames = async () => {
    try {
      const data = await listResources('game');
      setCustomGames(data);
    } catch (e) {
      console.warn('Lỗi tải danh sách game:', e);
    }
  };

  useEffect(() => {
    if (activeGame === 'cards') {
      fetchCustomGames();
    }
  }, [activeGame]);

  // Lucky Wheel state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelWinner, setWheelWinner] = useState<string | null>(null);
  const rotationAngleRef = useRef(0);

  // Cac o thuong cua Vong quay - co the them/sua/xoa, luu lai theo trinh duyet (localStorage)
  // vi day la noi dung trang tri/tro choi, khong phai du lieu hoc tap can dong bo Supabase.
  const WHEEL_COLOR_PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#F97316', '#14B8A6'];
  const [wheelItems, setWheelItems] = useState<{ text: string; color: string }[]>(() => {
    try {
      const saved = localStorage.getItem('qllh_wheel_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 2) return parsed;
      }
    } catch {}
    return PRIZE_WHEEL_ITEMS.map((i) => ({ text: i.text, color: i.color }));
  });
  useEffect(() => {
    try {
      localStorage.setItem('qllh_wheel_items', JSON.stringify(wheelItems));
    } catch {}
  }, [wheelItems]);
  const [showWheelManageModal, setShowWheelManageModal] = useState(false);

  // Mystery Box state - noi dung tung hop va so luong hop co the them/sua/xoa, luu localStorage
  const DEFAULT_MYSTERY_REWARDS = [
    { title: '🌟 +3 Sao thi đua!', desc: 'Phần thưởng xuất sắc cho bạn may mắn nhất!' },
    { title: '🎁 1 Chiếc Sticker siêu cấp', desc: 'Nhận ngay sticker đáng yêu từ thầy cô!' },
    { title: '👏 Cả lớp dành 1 tràng pháo tay', desc: 'Âm thanh rộn ràng cổ vũ tinh thần học tập!' },
    { title: '👑 Quyền năng Trưởng nhóm hôm nay', desc: 'Em được chọn bạn cùng nhóm trong hoạt động tới!' },
    { title: '🎵 Bài hát tự chọn yêu thích', desc: 'Cả lớp cùng nghe giai điệu em yêu thích trong giờ ra chơi!' },
    { title: '⭐ +2 Sao chăm ngoan', desc: 'Một món quà bất ngờ tiếp thêm động lực!' },
  ];
  const [openedBoxes, setOpenedBoxes] = useState<number[]>([]);
  const [mysteryRewards, setMysteryRewards] = useState<{ title: string; desc: string }[]>(() => {
    try {
      const saved = localStorage.getItem('qllh_mystery_rewards');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 1) return parsed;
      }
    } catch {}
    return DEFAULT_MYSTERY_REWARDS;
  });
  useEffect(() => {
    try {
      localStorage.setItem('qllh_mystery_rewards', JSON.stringify(mysteryRewards));
    } catch {}
  }, [mysteryRewards]);
  const [showMysteryManageModal, setShowMysteryManageModal] = useState(false);

  // Brain Break state - danh sach dong tac co the them/sua/xoa, luu localStorage
  const [breakSeconds, setBreakSeconds] = useState(120);
  const [isBreakRunning, setIsBreakRunning] = useState(false);
  const [exerciseIndex, setExerciseIndex] = useState(0);

  const DEFAULT_EXERCISES = [
    { title: 'Vươn vai hít thở sâu', desc: 'Hai tay đưa lên cao, hít vào thật sâu rồi từ từ thở ra 5 lần', icon: '🧘' },
    { title: 'Xoay cổ tay và khớp vai', desc: 'Xoay tròn cổ tay 10 vòng để thư giãn sau khi gõ bàn phím', icon: '🤸' },
    { title: 'Vỗ tay theo nhịp điệu vui nhộn', desc: 'Vỗ tay 1 - 2 - 3, cười thật tươi cùng các bạn trong bàn!', icon: '👏' },
    { title: 'Chớp mắt và nhìn xa 20 giây', desc: 'Nhìn ra ngoài cửa sổ để thư giãn mắt sau bài học trên màn hình', icon: '👀' },
  ];
  const [exercises, setExercises] = useState<{ title: string; desc: string; icon: string }[]>(() => {
    try {
      const saved = localStorage.getItem('qllh_brain_break_exercises');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 1) return parsed;
      }
    } catch {}
    return DEFAULT_EXERCISES;
  });
  useEffect(() => {
    try {
      localStorage.setItem('qllh_brain_break_exercises', JSON.stringify(exercises));
    } catch {}
  }, [exercises]);
  const [showExerciseManageModal, setShowExerciseManageModal] = useState(false);

  // Draw wheel on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = width / 2 - 12;

    const numSlices = wheelItems.length;
    const sliceAngle = (2 * Math.PI) / numSlices;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationAngleRef.current);

    // Draw slices
    wheelItems.forEach((item, i) => {
      const angle = i * sliceAngle;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, angle, angle + sliceAngle);
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Text
      ctx.save();
      ctx.rotate(angle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px Plus Jakarta Sans, sans-serif';
      ctx.fillText(item.text, radius - 20, 5);
      ctx.restore();
    });

    ctx.restore();

    // Center pin
    ctx.beginPath();
    ctx.arc(centerX, centerY, 22, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎯', centerX, centerY);
    // activeGame: canvas bi unmount khi chuyen tab roi quay lai (chi render khi
    // activeGame === 'wheel'), nen can ve lai moi khi tab nay duoc mo lai, khong
    // chi khi wheelItems thay doi - neu khong canvas moi mount se bi trang.
  }, [rotationAngleRef.current, wheelItems, activeGame]);

  const handleSpinWheel = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setWheelWinner(null);

    const spinDuration = 3500;
    const startTime = performance.now();
    const startAngle = rotationAngleRef.current;
    const randomRotations = 5 + Math.random() * 4;
    const totalRotate = randomRotations * 2 * Math.PI;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const currentAngle = startAngle + totalRotate * ease;

      rotationAngleRef.current = currentAngle;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;
          const centerX = width / 2;
          const centerY = height / 2;
          const radius = width / 2 - 12;
          const numSlices = wheelItems.length;
          const sliceAngle = (2 * Math.PI) / numSlices;

          ctx.clearRect(0, 0, width, height);
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(currentAngle);

          wheelItems.forEach((item, i) => {
            const angle = i * sliceAngle;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, angle, angle + sliceAngle);
            ctx.fillStyle = item.color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            ctx.save();
            ctx.rotate(angle + sliceAngle / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 13px Plus Jakarta Sans, sans-serif';
            ctx.fillText(item.text, radius - 20, 5);
            ctx.restore();
          });

          ctx.restore();

          // Center pin
          ctx.beginPath();
          ctx.arc(centerX, centerY, 22, 0, 2 * Math.PI);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#f59e0b';
          ctx.stroke();
          ctx.font = 'bold 14px sans-serif';
          ctx.fillStyle = '#1e293b';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🎯', centerX, centerY);
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        // Calculate winning slice
        const normalizedAngle = (2 * Math.PI - (currentAngle % (2 * Math.PI))) % (2 * Math.PI);
        const sliceAngle = (2 * Math.PI) / wheelItems.length;
        const winnerIndex = Math.floor(normalizedAngle / sliceAngle);
        const winner = wheelItems[winnerIndex] || wheelItems[0];
        setWheelWinner(winner.text);
        soundManager.playFanfare();

        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#F59E0B', '#3B82F6', '#10B981', '#EC4899']
        });
      }
    };

    requestAnimationFrame(animate);
  };

  const handleOpenBox = (boxIdx: number) => {
    if (openedBoxes.includes(boxIdx)) return;
    setOpenedBoxes([...openedBoxes, boxIdx]);
    soundManager.playFanfare();
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7 }
    });
  };

  // CRUD cho cac o cua Vong quay may man
  const handleAddWheelItem = () => {
    const color = WHEEL_COLOR_PALETTE[wheelItems.length % WHEEL_COLOR_PALETTE.length];
    setWheelItems((prev) => [...prev, { text: 'Ô thưởng mới', color }]);
  };
  const handleUpdateWheelItem = (idx: number, patch: Partial<{ text: string; color: string }>) => {
    setWheelItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const handleDeleteWheelItem = (idx: number) => {
    if (wheelItems.length <= 2) {
      alert('Vòng quay cần tối thiểu 2 ô thưởng.');
      return;
    }
    setWheelItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // CRUD cho cac hop qua bi mat (noi dung + so luong hop)
  const handleAddMysteryBox = () => {
    setMysteryRewards((prev) => [...prev, { title: '🎁 Phần thưởng mới', desc: 'Nhập nội dung phần thưởng...' }]);
  };
  const handleUpdateMysteryBox = (idx: number, patch: Partial<{ title: string; desc: string }>) => {
    setMysteryRewards((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const handleDeleteMysteryBox = (idx: number) => {
    if (mysteryRewards.length <= 1) {
      alert('Cần tối thiểu 1 hộp quà.');
      return;
    }
    setMysteryRewards((prev) => prev.filter((_, i) => i !== idx));
    setOpenedBoxes((prev) => prev.filter((i) => i !== idx).map((i) => (i > idx ? i - 1 : i)));
  };

  // CRUD cho danh sach dong tac van dong giai lao
  const handleAddExercise = () => {
    setExercises((prev) => [...prev, { title: 'Động tác mới', desc: 'Nhập mô tả động tác...', icon: '🙆' }]);
  };
  const handleUpdateExercise = (idx: number, patch: Partial<{ title: string; desc: string; icon: string }>) => {
    setExercises((prev) => prev.map((ex, i) => (i === idx ? { ...ex, ...patch } : ex)));
  };
  const handleDeleteExercise = (idx: number) => {
    if (exercises.length <= 1) {
      alert('Cần tối thiểu 1 động tác.');
      return;
    }
    setExercises((prev) => prev.filter((_, i) => i !== idx));
    setExerciseIndex((prev) => (prev >= exercises.length - 1 ? 0 : prev));
  };

  // Brain break timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isBreakRunning && breakSeconds > 0) {
      interval = setInterval(() => {
        setBreakSeconds((prev) => {
          if (prev <= 1) {
            soundManager.playAlarm();
            setIsBreakRunning(false);
            return 0;
          }
          if (prev % 30 === 0) {
            setExerciseIndex((i) => (i + 1) % exercises.length);
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isBreakRunning, breakSeconds]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
              Khu vui chơi & Thư giãn
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">Hoạt động trong lớp học</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">Giải trí lớp học</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Không gian trò chơi, vòng quay khen thưởng và hoạt động thư giãn sau giờ học
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveGame('wheel')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeGame === 'wheel' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Vòng quay may mắn
          </button>
          <button
            onClick={() => setActiveGame('mysteryBox')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeGame === 'mysteryBox' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Hộp quà bí mật
          </button>
          <button
            onClick={() => setActiveGame('brainBreak')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeGame === 'brainBreak' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Vận động 2 phút
          </button>
          <button
            onClick={() => setActiveGame('cards')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeGame === 'cards' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Trò chơi trực tuyến ({customGames.length})
          </button>
        </div>
      </div>

      {/* GAME 1: LUCKY WHEEL */}
      {activeGame === 'wheel' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xs flex flex-col items-center">
          <div className="text-center mb-6">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
              VÒNG QUAY MAY MẮN
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              Quay thưởng khen thưởng học sinh
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Nhấn nút quay để chọn phần quà hoặc nhiệm vụ bất ngờ cho học sinh
            </p>
          </div>

          {/* Wheel Container with Pointer */}
          <div className="relative flex flex-col items-center justify-center my-4">
            {/* Top Pointer arrow */}
            <div className="absolute -top-3 z-20 w-0 h-0 border-x-8 border-x-transparent border-t-[18px] border-t-rose-600 drop-shadow-md" />

            <canvas
              ref={canvasRef}
              width={340}
              height={340}
              className="rounded-full shadow-lg border-4 border-white"
            />
          </div>

          {/* Winner announcement */}
          {wheelWinner && (
            <div className="my-3 px-6 py-3 bg-gradient-to-r from-amber-50 to-yellow-100 border border-amber-300 rounded-2xl text-center animate-in zoom-in-95">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                Kết quả quay thưởng
              </span>
              <p className="text-2xl font-black text-slate-900 mt-1">{wheelWinner}</p>
            </div>
          )}

          {/* Spin Trigger Button */}
          <div className="mt-4 flex flex-col items-center gap-3">
            <button
              onClick={handleSpinWheel}
              disabled={isSpinning}
              className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white rounded-2xl font-black text-base shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <RotateCw className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} />
              <span>{isSpinning ? 'Đang quay vòng...' : 'Quay thưởng ngay!'}</span>
            </button>
            <button
              onClick={() => setShowWheelManageModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Quản lý ô thưởng ({wheelItems.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* GAME 2: MYSTERY BOXES */}
      {activeGame === 'mysteryBox' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xs">
          <div className="text-center mb-6">
            <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">
              HỘP QUÀ BÍ MẬT
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              Chọn 1 hộp quà may mắn
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Cho học sinh phát biểu chọn một số từ 1 đến {mysteryRewards.length} và mở quà
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {mysteryRewards.map((reward, i) => {
              const isOpened = openedBoxes.includes(i);
              return (
                <div
                  key={i}
                  onClick={() => handleOpenBox(i)}
                  className={`h-44 rounded-2xl border-2 p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative overflow-hidden ${
                    isOpened
                      ? 'bg-gradient-to-b from-purple-50 to-indigo-50 border-purple-300 shadow-sm'
                      : 'bg-gradient-to-b from-slate-50 to-slate-100 hover:from-purple-50 hover:to-purple-100 border-slate-200 hover:border-purple-300 shadow-2xs hover:scale-102'
                  }`}
                >
                  <div className="absolute top-2.5 left-3 text-xs font-extrabold text-slate-400 font-mono">
                    #{i + 1}
                  </div>

                  {isOpened ? (
                    <div className="animate-in zoom-in-90 duration-200 space-y-1">
                      <span className="text-3xl block">🎉</span>
                      <p className="font-extrabold text-purple-900 text-sm">{reward.title}</p>
                      <p className="text-[11px] text-slate-500 leading-tight">{reward.desc}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-2">
                      <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md">
                        <Gift className="w-7 h-7" />
                      </div>
                      <span className="text-xs font-bold text-slate-700">Chạm để mở</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2.5">
            <button
              onClick={() => setOpenedBoxes([])}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Đặt lại tất cả các hộp quà
            </button>
            <button
              onClick={() => setShowMysteryManageModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Quản lý nội dung hộp quà ({mysteryRewards.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* GAME 3: BRAIN BREAK 2 MINUTES */}
      {activeGame === 'brainBreak' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xs flex flex-col items-center text-center">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
            GIỜ GIẢI LAO NĂNG ĐỘNG
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Vận động thư giãn 2 phút
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Giúp học sinh thư giãn mắt, cột sống và nạp lại năng lượng cho bài học tiếp theo
          </p>

          {/* Big Timer */}
          <div className="my-8 flex flex-col items-center">
            <div className="w-48 h-48 rounded-full border-8 border-emerald-100 flex flex-col items-center justify-center bg-emerald-50/40 relative shadow-inner">
              <span className="text-4xl font-mono font-black text-emerald-700 tracking-wider">
                {Math.floor(breakSeconds / 60)}:
                {(breakSeconds % 60).toString().padStart(2, '0')}
              </span>
              <span className="text-xs text-slate-500 mt-1 font-medium">
                {isBreakRunning ? 'Đang đếm ngược' : 'Sẵn sàng'}
              </span>
            </div>
          </div>

          {/* Active Exercise Guidance */}
          {(() => {
            const current = exercises[exerciseIndex] || exercises[0];
            return (
              <div className="max-w-md w-full p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-left flex items-start gap-3">
                <span className="text-3xl select-none">{current.icon}</span>
                <div>
                  <h4 className="font-bold text-emerald-900 text-sm">
                    Động tác: {current.title}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {current.desc}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Action buttons */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => setIsBreakRunning(!isBreakRunning)}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Activity className="w-4 h-4" />
              <span>{isBreakRunning ? 'Tạm dừng vận động' : 'Bắt đầu 2 phút vận động'}</span>
            </button>

            <button
              onClick={() => {
                setIsBreakRunning(false);
                setBreakSeconds(120);
              }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              Đặt lại 2 phút
            </button>

            <button
              onClick={() => setShowExerciseManageModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Quản lý động tác ({exercises.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* GAME 4: ONLINE GAME CARDS (16:9) */}
      {activeGame === 'cards' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-indigo-600" />
                <span>Kho thẻ trò chơi trực tuyến dành cho lớp học</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Các game được kích hoạt sẽ hiển thị trên trang của học sinh
              </p>
            </div>

            <button
              onClick={() => {
                setEditingGame(null);
                setShowAddGameModal((prev) => !prev);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm thẻ game mới</span>
            </button>
          </div>

          {(showAddGameModal || editingGame) && (
            <GameCardForm
              key={editingGame?.id || 'new'}
              editing={editingGame}
              onSaved={() => {
                setShowAddGameModal(false);
                setEditingGame(null);
                fetchCustomGames();
              }}
              onCancel={() => {
                setShowAddGameModal(false);
                setEditingGame(null);
              }}
            />
          )}

          {customGames.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
              <Gamepad2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-xs">Chưa có trò chơi nào được thêm.</p>
              <button
                onClick={() => setShowAddGameModal(true)}
                className="mt-3 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
              >
                + Thêm trò chơi đầu tiên
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {customGames.map((game) => (
                <div
                  key={game.id}
                  className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Aspect 16:9 Thumbnail */}
                    <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                      <img
                        src={
                          game.thumbnailUrl ||
                          'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80'
                        }
                        alt={game.title}
                        className="w-full h-full object-cover opacity-90 hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2.5 right-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-xs ${
                            game.isActive
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-800/80 text-slate-300'
                          }`}
                        >
                          {game.isActive ? 'Đang mở cho HS' : 'Chưa kích hoạt'}
                        </span>
                      </div>
                    </div>

                    <div className="p-4">
                      <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                        {game.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 truncate font-mono">
                        {game.url}
                      </p>
                    </div>
                  </div>

                  {/* Actions: Kích hoạt, Mở chơi, Xóa */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={async () => {
                        try {
                          await setResourceActive(game.id, !game.isActive);
                          fetchCustomGames();
                        } catch (err: any) {
                          alert(`Lỗi: ${err.message}`);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        game.isActive
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{game.isActive ? 'Tắt' : 'Kích hoạt'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <a
                        href={game.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-xl bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Chơi thử game"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => {
                          setEditingGame(game);
                          setShowAddGameModal(false);
                        }}
                        className="p-1.5 rounded-xl bg-white border border-slate-200 text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                        title="Sửa thẻ game"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={async () => {
                          if (confirm(`Bạn có chắc muốn xóa thẻ game "${game.title}"?`)) {
                            try {
                              if (editingGame?.id === game.id) setEditingGame(null);
                              await deleteResource(game.id);
                              fetchCustomGames();
                            } catch (err: any) {
                              alert(`Lỗi khi xóa: ${err.message}`);
                            }
                          }
                        }}
                        className="p-1.5 rounded-xl bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Xóa thẻ game"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Quan ly o thuong Vong quay may man (them/sua/xoa) */}
      {showWheelManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base">Quản lý ô thưởng Vòng quay</h3>
              <button
                onClick={() => setShowWheelManageModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {wheelItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={item.color}
                    onChange={(e) => handleUpdateWheelItem(idx, { color: e.target.value })}
                    className="w-8 h-8 rounded-lg border border-slate-200 shrink-0 cursor-pointer"
                    title="Màu ô"
                  />
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => handleUpdateWheelItem(idx, { text: e.target.value })}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                    placeholder="Nội dung ô thưởng"
                  />
                  <button
                    onClick={() => handleDeleteWheelItem(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors shrink-0 cursor-pointer"
                    title="Xóa ô này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                onClick={handleAddWheelItem}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm ô thưởng</span>
              </button>
              <button
                onClick={() => setShowWheelManageModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Quan ly noi dung + so luong Hop qua bi mat (them/sua/xoa) */}
      {showMysteryManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base">Quản lý nội dung Hộp quà bí mật</h3>
              <button
                onClick={() => setShowMysteryManageModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {mysteryRewards.map((reward, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-400 font-mono">Hộp #{idx + 1}</span>
                    <button
                      onClick={() => handleDeleteMysteryBox(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Xóa hộp này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={reward.title}
                    onChange={(e) => handleUpdateMysteryBox(idx, { title: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg"
                    placeholder="Tiêu đề phần thưởng (VD: 🌟 +3 Sao thi đua!)"
                  />
                  <input
                    type="text"
                    value={reward.desc}
                    onChange={(e) => handleUpdateMysteryBox(idx, { desc: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                    placeholder="Mô tả ngắn"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                onClick={handleAddMysteryBox}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm hộp quà</span>
              </button>
              <button
                onClick={() => setShowMysteryManageModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Quan ly danh sach dong tac van dong giai lao (them/sua/xoa) */}
      {showExerciseManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base">Quản lý động tác vận động giải lao</h3>
              <button
                onClick={() => setShowExerciseManageModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {exercises.map((ex, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={ex.icon}
                      onChange={(e) => handleUpdateExercise(idx, { icon: e.target.value })}
                      className="w-12 px-2 py-1.5 text-base text-center border border-slate-200 rounded-lg shrink-0"
                      title="Biểu tượng (emoji)"
                      maxLength={4}
                    />
                    <input
                      type="text"
                      value={ex.title}
                      onChange={(e) => handleUpdateExercise(idx, { title: e.target.value })}
                      className="flex-1 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg"
                      placeholder="Tên động tác"
                    />
                    <button
                      onClick={() => handleDeleteExercise(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors shrink-0 cursor-pointer"
                      title="Xóa động tác này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={ex.desc}
                    onChange={(e) => handleUpdateExercise(idx, { desc: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                    placeholder="Mô tả động tác"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                onClick={handleAddExercise}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm động tác</span>
              </button>
              <button
                onClick={() => setShowExerciseManageModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
