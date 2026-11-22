import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  LogIn,
  Play,
  RotateCcw,
  Sparkles,
  Clock,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  Trophy,
  Award,
  Video,
  Gamepad2,
  ArrowRight,
  Check,
  X,
  AlertTriangle,
  GraduationCap,
  FileSpreadsheet,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QuizSubmission, Classroom, Resource, Student } from '../types';
import { soundManager } from '../utils/audio';
import { signInStudentWithRoomCode } from '../services/authService';
import { startExamSession, submitExamSession, ExamQuestion } from '../services/examService';
import { listTopics, QuizTopicItem } from '../services/quizService';
import { listResources } from '../services/resourcesService';
import { listStudentsByClass } from '../services/studentsService';

interface StudentPortalProps {
  roomCode: string;
  teacherUsername?: string;
  classrooms: Classroom[];
  onOpenTeacherLogin: () => void;
  onRecordSubmission?: (sub: QuizSubmission) => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  roomCode,
  teacherUsername = 'Giáo viên',
  classrooms,
  onOpenTeacherLogin,
  onRecordSubmission,
}) => {
  // Navigation inside Student Portal:
  // 'code_entry' -> Image 1 (Landing code entry)
  // 'hub' -> Image 2 (Grade selection & hero card)
  // 'quiz_active' -> Doing the quiz
  // 'quiz_result' -> Quiz completed screen
  const [currentView, setCurrentView] = useState<'code_entry' | 'hub' | 'quiz_active' | 'quiz_result'>('code_entry');

  // Input code state
  const [enteredCode, setEnteredCode] = useState('');
  const [codeError, setCodeError] = useState('');

  // Lớp thật đã xác nhận qua mã phòng (dùng để lấy đúng danh sách học sinh thật của lớp)
  const [joinedClassId, setJoinedClassId] = useState<string | null>(null);
  const [rosterStudents, setRosterStudents] = useState<Student[]>([]);
  const [isPreparingExam, setIsPreparingExam] = useState(false);

  // Selected grade in Hub (Khối 1 to 5)
  const [selectedGrade, setSelectedGrade] = useState<number>(4);

  // Student Info Modal for starting quiz
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [pendingTopicIds, setPendingTopicIds] = useState<string[]>([]);
  // Thí sinh tự do: không có trong danh sách lớp, tự gõ tên + tên trường
  const [isFreeEntry, setIsFreeEntry] = useState(false);
  const [freeStudentName, setFreeStudentName] = useState('');
  const [freeSchoolName, setFreeSchoolName] = useState('');

  // Chọn chủ đề thi (chế độ "mở" - khi khối chưa bị giáo viên khóa 1 chủ đề cụ thể)
  const [isTopicPickerOpen, setIsTopicPickerOpen] = useState(false);
  const [pickableTopics, setPickableTopics] = useState<QuizTopicItem[]>([]);

  // Quiz Taking state
  const [activeQuizList, setActiveQuizList] = useState<ExamQuestion[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState<Record<number, number>>({});
  const [timeRemaining, setTimeRemaining] = useState(900); // 15 mins = 900s
  const [startTime, setStartTime] = useState<number>(0);
  const [latestSubmission, setLatestSubmission] = useState<QuizSubmission | null>(null);
  const [isSubmittingExam, setIsSubmittingExam] = useState(false);

  // Digital resources & game preview modal
  const [activeResourceModal, setActiveResourceModal] = useState<Resource | null>(null);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [isResourcesListOpen, setIsResourcesListOpen] = useState(false);
  const [activeGamesList, setActiveGamesList] = useState<Resource[]>([]);
  const [activeLinksList, setActiveLinksList] = useState<Resource[]>([]);
  const [activeVideosList, setActiveVideosList] = useState<Resource[]>([]);

  useEffect(() => {
    if (isGameModalOpen) {
      listResources('game')
        .then((data) => setActiveGamesList(data.filter((g) => g.isActive !== false)))
        .catch(() => {});
    }
  }, [isGameModalOpen]);

  useEffect(() => {
    if (isResourcesListOpen) {
      listResources('link')
        .then((data) => setActiveLinksList(data.filter((l) => l.isActive !== false)))
        .catch(() => {});
      listResources('video', selectedGrade)
        .then((data) => setActiveVideosList(data.filter((v) => v.isActive !== false)))
        .catch(() => {});
    }
  }, [isResourcesListOpen, selectedGrade]);

  // Validate room code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError('');

    const trimmed = enteredCode.trim().toUpperCase();
    if (!trimmed) {
      setCodeError('Vui lòng nhập mã lớp học từ Giáo viên của em!');
      return;
    }

    // Xác thực qua Supabase Anonymous Auth và kiểm tra room_code thật
    try {
      const result = await signInStudentWithRoomCode(trimmed);
      if ('error' in result) {
        soundManager.playTick();
        setCodeError(result.error || `Mã lớp "${trimmed}" chưa chính xác.`);
        return;
      }

      setJoinedClassId(result.classId);
      // Tải danh sách học sinh thật của đúng lớp này để học sinh chọn tên khi làm bài
      listStudentsByClass(result.classId)
        .then(setRosterStudents)
        .catch(() => setRosterStudents([]));

      soundManager.playFanfare();
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.6 }
      });
      setCurrentView('hub');
    } catch (err: any) {
      soundManager.playTick();
      setCodeError(err.message || 'Lỗi khi tham gia phòng học');
    }
  };

  // Open Name Input Modal: kiểm tra trước xem khối này có chủ đề thi nào đang kích hoạt không.
  // Quy tắc (theo C7):
  // - Nếu khối có 1 chủ đề đang bị giáo viên "khóa" (isForced) -> bỏ qua bước chọn,
  //   tự động vào thẳng chủ đề đó, các chủ đề active khác bị ẩn.
  // - Nếu không có chủ đề nào bị khóa -> cho học sinh tự chọn đúng 1 trong các chủ đề
  //   đang active (không gộp pool nhiều chủ đề nữa).
  const handlePrepareQuiz = async () => {
    setIsPreparingExam(true);
    try {
      const allTopics = await listTopics();
      const activeTopicsOfGrade = allTopics.filter(
        (t) => t.grade === selectedGrade && t.isActive
      );

      if (activeTopicsOfGrade.length === 0) {
        alert(`Hiện tại chưa có đề thi trắc nghiệm cho Khối ${selectedGrade}. Thầy cô có thể bật đề trong phần quản trị!`);
        return;
      }

      const forcedTopic = activeTopicsOfGrade.find((t) => t.isForced);
      if (forcedTopic) {
        setPendingTopicIds([forcedTopic.id]);
        soundManager.playStarSound();
        setIsNameModalOpen(true);
        return;
      }

      // Chế độ "mở": hiện danh sách chủ đề active để học sinh tự chọn đúng 1 cái
      setPickableTopics(activeTopicsOfGrade);
      soundManager.playStarSound();
      setIsTopicPickerOpen(true);
    } catch (err: any) {
      alert(err.message || 'Không thể tải đề thi, vui lòng thử lại.');
    } finally {
      setIsPreparingExam(false);
    }
  };

  // Học sinh đã chọn đúng 1 chủ đề trong chế độ "mở" -> tiếp tục sang bước nhập tên
  const handleChooseTopic = (topicId: string) => {
    setPendingTopicIds([topicId]);
    setIsTopicPickerOpen(false);
    soundManager.playStarSound();
    setIsNameModalOpen(true);
  };

  // Start the timed quiz: tạo phiên thi thật trên server (câu hỏi xáo trộn, không lộ đáp án đúng)
  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = isFreeEntry ? freeStudentName.trim() : studentName.trim();
    if (!finalName) return;
    if (!isFreeEntry && rosterStudents.length === 0) {
      alert('Lớp này chưa có danh sách học sinh nên chưa thể làm bài. Em báo Thầy/Cô thêm danh sách lớp trước nhé!');
      return;
    }

    try {
      const { sessionId, questions } = await startExamSession(
        finalName,
        isFreeEntry ? null : joinedClassId,
        isFreeEntry,
        pendingTopicIds,
        isFreeEntry ? freeSchoolName.trim() || undefined : undefined
      );
      setCurrentSessionId(sessionId);
      setActiveQuizList(questions);
    } catch (err: any) {
      alert(err.message || 'Không thể bắt đầu bài thi, vui lòng thử lại.');
      return;
    }
    if (isFreeEntry) setStudentName(finalName);

    setCurrentQIndex(0);
    setStudentAnswers({});
    setTimeRemaining(900);
    setStartTime(Date.now());
    setIsNameModalOpen(false);
    setCurrentView('quiz_active');
    soundManager.playFanfare();
  };

  // Timer countdown during quiz
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (currentView === 'quiz_active' && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleSubmitExam();
            return 0;
          }
          if (prev <= 10) {
            soundManager.playTick();
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [currentView, timeRemaining]);

  // Submit the student's exam: gửi câu trả lời lên server để server tự chấm điểm (không lộ đáp án đúng ở máy học sinh)
  const handleSubmitExam = async () => {
    if (!currentSessionId || isSubmittingExam) return;
    setIsSubmittingExam(true);

    const elapsedSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const answers = activeQuizList.map((q, idx) => ({
      questionId: q.id,
      selectedOptionIndex: studentAnswers[idx] ?? -1,
    }));

    try {
      const result = await submitExamSession(currentSessionId, answers, elapsedSeconds);

      const now = new Date();
      const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const submission: QuizSubmission = {
        id: currentSessionId,
        studentName: studentName.trim(),
        className: classrooms.find((c) => c.id === joinedClassId)?.name || 'Tự do',
        schoolName: isFreeEntry ? freeSchoolName.trim() || undefined : undefined,
        grade: selectedGrade,
        score: result.score,
        totalQuestions: result.totalQuestions,
        correctAnswers: result.correctCount,
        submittedAt: formattedDate,
        durationSeconds: elapsedSeconds,
      };

      setLatestSubmission(submission);
      setCurrentView('quiz_result');

      if (onRecordSubmission) {
        onRecordSubmission(submission);
      }

      soundManager.playFanfare();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.5 }
      });
    } catch (err: any) {
      alert(err.message || 'Không thể nộp bài thi, vui lòng thử lại.');
    } finally {
      setIsSubmittingExam(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Grade count for display badge

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      {/* ======================================================== */}
      {/* TOP HEADER (Identical to reference screenshot) */}
      {/* ======================================================== */}
      <header className="bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        {/* Left: Logo & Slogan */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#0284c7] text-white flex items-center justify-center shadow-xs">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-[#0369a1] text-base sm:text-lg leading-tight">
              Kiến thức tin học
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Kết nối tri thức với cuộc sống
            </p>
          </div>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-3">
          {currentView !== 'code_entry' && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full font-medium">
              <span>Lớp của:</span>
              <span className="font-bold text-slate-800">{teacherUsername}</span>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => {
                  setCurrentView('code_entry');
                  setEnteredCode('');
                }}
                className="text-rose-600 hover:text-rose-700 font-bold hover:underline"
              >
                Đổi mã lớp
              </button>
            </div>
          )}

          <button
            onClick={onOpenTeacherLogin}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 border border-blue-500/30 text-blue-700 bg-blue-50/60 hover:bg-blue-100 hover:text-blue-800 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-2xs cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng nhập Giáo viên</span>
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* VIEW 1: LANDING CODE ENTRY (MATCHES IMAGE 1) */}
      {/* ======================================================== */}
      {currentView === 'code_entry' && (
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Blue Curved Header with Book Icon */}
            <div className="bg-[#0ea5e9] text-white p-7 text-center relative flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center mb-3 shadow-inner">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Nhập mã lớp học
              </h2>
              <p className="text-xs sm:text-sm text-sky-950 font-medium mt-1 leading-snug">
                Nhập mã code từ Giáo viên của em để làm bài tập và xem bài giảng
              </p>
            </div>

            {/* White Body Form */}
            <form onSubmit={handleVerifyCode} className="p-6 sm:p-8 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">
                  Mã code Giáo viên
                </label>
                <input
                  type="text"
                  value={enteredCode}
                  onChange={(e) => {
                    setEnteredCode(e.target.value.toUpperCase());
                    setCodeError('');
                  }}
                  placeholder="VÍ DỤ: A1B2C3"
                  className="w-full py-3.5 px-6 text-center text-lg sm:text-xl font-mono font-bold tracking-widest text-slate-800 placeholder-slate-400 bg-white border-2 border-sky-200 focus:border-sky-500 rounded-full focus:outline-hidden focus:ring-4 focus:ring-sky-100 transition-all uppercase"
                  autoFocus
                />
              </div>

              {codeError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center animate-in shake">
                  {codeError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 px-6 bg-[#10b981] hover:bg-[#059669] text-white rounded-full font-bold text-base shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Vào lớp học</span>
                <span className="text-lg">🚀</span>
              </button>

              {/* Quick helper for students — chỉ hiện khi có mã phòng thật (vd giáo viên đang xem thử Cổng Học sinh) */}
              {roomCode && (
                <div className="pt-2 text-center">
                  <p className="text-xs text-slate-400">
                    Mã phòng học hiện tại của {teacherUsername}:{' '}
                    <button
                      type="button"
                      onClick={() => setEnteredCode(roomCode)}
                      className="font-mono font-bold text-sky-600 hover:underline bg-sky-50 px-2 py-0.5 rounded border border-sky-100"
                    >
                      {roomCode}
                    </button>
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: STUDENT HUB & GRADE PICKER (MATCHES IMAGE 2) */}
      {/* ======================================================== */}
      {currentView === 'hub' && (
        <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
          {/* Mobile switcher for teacher name & change code */}
          <div className="sm:hidden flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500">
              Lớp: <strong className="text-slate-800">{teacherUsername}</strong>
            </span>
            <button
              onClick={() => setCurrentView('code_entry')}
              className="text-rose-600 font-bold hover:underline"
            >
              Đổi mã lớp
            </button>
          </div>

          {/* Grade Selector Container */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-center font-bold text-slate-800 text-sm sm:text-base flex items-center justify-center gap-2">
              <span className="text-lg">🎒</span>
              <span>Chọn Khối lớp của em để học và làm bài tập</span>
            </h3>

            {/* 5 Grade Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
              {[
                { grade: 1, label: 'Khối 1', icon: '🎒' },
                { grade: 2, label: 'Khối 2', icon: '✏️' },
                { grade: 3, label: 'Khối 3', icon: '📐' },
                { grade: 4, label: 'Khối 4', icon: '💻' },
                { grade: 5, label: 'Khối 5', icon: '🚀' },
              ].map((item) => {
                const isSelected = selectedGrade === item.grade;
                return (
                  <button
                    key={item.grade}
                    onClick={() => {
                      setSelectedGrade(item.grade);
                      soundManager.playStarSound();
                    }}
                    className={`py-3 px-4 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0284c7] text-white shadow-md shadow-sky-500/25 scale-[1.03]'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Big Hero Card: Luyện tập trực tuyến (Rich blue gradient) */}
          <div className="relative rounded-3xl bg-gradient-to-r from-[#0ea5e9] via-[#0284c7] to-[#2563eb] text-white p-6 sm:p-10 shadow-xl overflow-hidden space-y-6">
            {/* Top pill badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>LUYỆN TẬP TRỰC TUYẾN</span>
            </div>

            {/* Headline & Description */}
            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Bài tập Kiến thức tin học
              </h2>
              <p className="text-sky-100 text-sm sm:text-base font-medium">
                Học vui – Luyện tập dễ – Kiểm tra ngay!
              </p>
            </div>

            {/* Metadata Tags */}
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <div className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-xs flex items-center gap-1.5 text-white">
                <span>📚</span>
                <span>Môn: Tin học</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-xs flex items-center gap-1.5 text-white">
                <span>🎓</span>
                <span>Lớp: {selectedGrade}</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-xs flex items-center gap-1.5 text-white">
                <span>📖</span>
                <span>Sách: Kết nối tri thức</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-xs flex items-center gap-1.5 text-white">
                <span>📝</span>
                <span>Số câu: tối đa 10 câu</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-xs flex items-center gap-1.5 text-white">
                <span>⏱️</span>
                <span>Thời gian: 15 phút</span>
              </div>
            </div>

            {/* 3 Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Start Quiz button (Vibrant Orange) */}
              <button
                onClick={handlePrepareQuiz}
                disabled={isPreparingExam}
                className="px-6 sm:px-8 py-3.5 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-full font-bold text-sm sm:text-base shadow-lg shadow-orange-600/30 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{isPreparingExam ? 'Đang tải đề...' : 'Bắt đầu làm bài'}</span>
              </button>

              {/* Digital Resources button */}
              <button
                onClick={() => setIsResourcesListOpen(true)}
                className="px-5 sm:px-6 py-3.5 bg-white/20 hover:bg-white/30 text-white rounded-full font-bold text-xs sm:text-sm backdrop-blur-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Học liệu số</span>
              </button>

              {/* Games button */}
              <button
                onClick={() => setIsGameModalOpen(true)}
                className="px-5 sm:px-6 py-3.5 bg-white/20 hover:bg-white/30 text-white rounded-full font-bold text-xs sm:text-sm backdrop-blur-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Gamepad2 className="w-4 h-4" />
                <span>Giải trí</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CHỌN CHỦ ĐỀ THI (chế độ "mở" - không có chủ đề bị khóa) */}
      {/* ======================================================== */}
      {isTopicPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-sky-50 to-blue-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Chọn chủ đề thi</h3>
                <p className="text-xs text-slate-500">
                  Khối {selectedGrade} - Chọn đúng 1 chủ đề để bắt đầu làm bài
                </p>
              </div>
              <button
                onClick={() => setIsTopicPickerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-2.5 max-h-[60vh] overflow-y-auto">
              {pickableTopics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => handleChooseTopic(topic.id)}
                  className="w-full text-left p-4 rounded-2xl border-2 border-slate-200 hover:border-sky-500 hover:bg-sky-50/60 transition-all flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-800 truncate">{topic.name}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{topic.questionCount} câu hỏi</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-sky-500 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: NHẬP TÊN & CHỌN LỚP TRƯỚC KHI BẮT ĐẦU */}
      {/* ======================================================== */}
      {isNameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-sky-50 to-blue-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold">
                  📝
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    Thông tin học sinh làm bài
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bài thi trắc nghiệm Tin học - Khối {selectedGrade}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNameModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleStartExam} className="p-6 space-y-4">
              {/* Chuyển đổi: học sinh trong lớp <-> thí sinh tự do */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setIsFreeEntry(false)}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    !isFreeEntry ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Học sinh trong lớp
                </button>
                <button
                  type="button"
                  onClick={() => setIsFreeEntry(true)}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    isFreeEntry ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Thí sinh tự do
                </button>
              </div>

              {isFreeEntry ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Họ và tên của em <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={freeStudentName}
                      onChange={(e) => setFreeStudentName(e.target.value)}
                      placeholder="Nhập họ và tên của em"
                      className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-white"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Trường của em
                    </label>
                    <input
                      type="text"
                      value={freeSchoolName}
                      onChange={(e) => setFreeSchoolName(e.target.value)}
                      placeholder="Nhập tên trường của em"
                      className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Em là bạn nào trong lớp? <span className="text-rose-500">*</span>
                  </label>
                  {rosterStudents.length > 0 ? (
                    <div className="relative">
                      <GraduationCap className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <select
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-white appearance-none"
                        required
                        autoFocus
                      >
                        <option value="">-- Chọn tên của em --</option>
                        {rosterStudents.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                      <p>
                        Lớp này chưa có danh sách học sinh nên chưa thể làm bài. Em báo Thầy/Cô thêm danh sách lớp trước nhé, hoặc chọn "Thí sinh tự do" ở trên!
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <p>
                  Bài thi có <strong>15 phút</strong> làm bài. Điểm số của em sẽ tự động được gửi về bảng điểm của Thầy Cô!
                </p>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsNameModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isFreeEntry ? !freeStudentName.trim() : !studentName.trim() || rosterStudents.length === 0}
                  className="flex-1 py-2.5 bg-[#ea580c] hover:bg-[#c2410c] disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Vào thi ngay</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 3: ACTIVE QUIZ EXAM SCREEN */}
      {/* ======================================================== */}
      {currentView === 'quiz_active' && activeQuizList.length > 0 && (
        <div className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-4">
          {/* Top Bar with Timer & Progress */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                K{selectedGrade}
              </div>
              <div>
                <p className="text-xs text-slate-400">Học sinh:</p>
                <p className="font-bold text-xs text-slate-800">{studentName}</p>
              </div>
            </div>

            {/* Timer countdown */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold ${
                timeRemaining <= 60
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-slate-900 text-emerald-400'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTime(timeRemaining)}</span>
            </div>

            <button
              onClick={() => {
                if (confirm('Em có chắc chắn muốn nộp bài thi ngay bây giờ không?')) {
                  handleSubmitExam();
                }
              }}
              disabled={isSubmittingExam}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
            >
              {isSubmittingExam ? 'Đang nộp...' : 'Nộp bài thi'}
            </button>
          </div>

          {/* Question Card */}
          {activeQuizList[currentQIndex] && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-100 pb-3">
                <span className="font-semibold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-md">
                  Câu hỏi {currentQIndex + 1} / {activeQuizList.length}
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed">
                {activeQuizList[currentQIndex].content}
              </h3>

              {activeQuizList[currentQIndex].imageUrl && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 max-h-72 flex items-center justify-center bg-slate-50">
                  <img
                    src={activeQuizList[currentQIndex].imageUrl}
                    alt="Hình minh họa câu hỏi"
                    className="w-full h-full object-contain max-h-72"
                  />
                </div>
              )}

              {/* Options */}
              <div className="space-y-3">
                {activeQuizList[currentQIndex].options.map((option, optIdx) => {
                  const letter = String.fromCharCode(65 + optIdx);
                  const isSelected = studentAnswers[currentQIndex] === optIdx;

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => {
                        setStudentAnswers((prev) => ({
                          ...prev,
                          [currentQIndex]: optIdx,
                        }));
                        soundManager.playTick();
                      }}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-3.5 cursor-pointer ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50/80 text-sky-950 font-semibold ring-2 ring-sky-200'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {letter}
                      </div>
                      <span className="text-sm leading-snug">{option}</span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentQIndex === 0}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Câu trước</span>
                </button>

                {/* Question index quick jump dots */}
                <div className="flex items-center gap-1.5">
                  {activeQuizList.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentQIndex(idx)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                        currentQIndex === idx
                          ? 'bg-sky-600 text-white ring-2 ring-sky-300'
                          : studentAnswers[idx] !== undefined
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>

                {currentQIndex < activeQuizList.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQIndex((prev) => Math.min(activeQuizList.length - 1, prev + 1))}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>Câu sau</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitExam}
                    disabled={isSubmittingExam}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs disabled:opacity-50"
                  >
                    {isSubmittingExam ? 'Đang nộp...' : 'Nộp bài'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 4: QUIZ RESULT SCREEN */}
      {/* ======================================================== */}
      {currentView === 'quiz_result' && latestSubmission && (
        <div className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl text-center space-y-6 animate-in zoom-in-95 duration-200">
            {/* Trophy Icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-50 text-amber-500 border-4 border-amber-200 shadow-lg mx-auto">
              <Trophy className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                Đã nộp bài thành công
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                Chúc mừng em {latestSubmission.studentName}!
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Lớp {latestSubmission.className || 'Tự do'} · Môn Tin học Khối {latestSubmission.grade}
              </p>
            </div>

            {/* Score Showcase */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="p-3 bg-white rounded-xl shadow-2xs">
                <p className="text-[11px] text-slate-400 font-medium">Điểm số</p>
                <p className="text-2xl sm:text-3xl font-black text-sky-600">
                  {latestSubmission.score}
                  <span className="text-xs text-slate-400 font-normal"> / 10</span>
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl shadow-2xs">
                <p className="text-[11px] text-slate-400 font-medium">Số câu đúng</p>
                <p className="text-2xl sm:text-3xl font-black text-emerald-600">
                  {latestSubmission.correctAnswers}
                  <span className="text-xs text-slate-400 font-normal"> / {latestSubmission.totalQuestions}</span>
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl shadow-2xs">
                <p className="text-[11px] text-slate-400 font-medium">Thời gian làm</p>
                <p className="text-xl sm:text-2xl font-black text-indigo-600 mt-1">
                  {formatTime(latestSubmission.durationSeconds)}
                </p>
              </div>
            </div>

            {/* Classification banner */}
            <div
              className={`p-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 ${
                latestSubmission.score >= 9
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : latestSubmission.score >= 5
                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              <Award className="w-5 h-5 shrink-0" />
              <span>
                {latestSubmission.score >= 9
                  ? 'Xếp loại: Hoàn thành Tốt (T) - Em học rất xuất sắc!'
                  : latestSubmission.score >= 5
                  ? 'Xếp loại: Hoàn thành (H) - Em làm bài rất tốt!'
                  : 'Xếp loại: Cần cố gắng hơn (C) - Em hãy ôn tập thêm nhé!'}
              </span>
            </div>

            {/* Lưu ý: không hiện lại đáp án đúng từng câu ở đây để tránh lộ đề cho bạn làm sau */}
            {(
              <div className="text-left pt-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 text-center">
                  Đáp án chi tiết sẽ được Thầy Cô công bố trên lớp để tránh lộ đề cho các bạn làm sau nhé!
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setCurrentView('hub');
                }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Về trang chủ học sinh
              </button>
              <button
                onClick={handlePrepareQuiz}
                className="flex-1 py-3 bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Luyện tập lại bài này</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: HỌC LIỆU SỐ DÀNH CHO HỌC SINH */}
      {/* ======================================================== */}
      {isResourcesListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-sky-50">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-slate-800 text-base">
                  Kho Học liệu số Tin học - Khối {selectedGrade}
                </h3>
              </div>
              <button
                onClick={() => setIsResourcesListOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {activeVideosList.length === 0 && activeLinksList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Chưa có học liệu nào cho Khối {selectedGrade}. Thầy cô sẽ tải lên sớm!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeVideosList.map((res) => (
                    <div
                      key={res.id}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col justify-between"
                    >
                      <div
                        onClick={() => setActiveResourceModal(res)}
                        className="relative aspect-video w-full bg-slate-900 overflow-hidden cursor-pointer"
                      >
                        <img
                          src={res.thumbnailUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80'}
                          alt={res.title}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300 opacity-90"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <div className="w-11 h-11 rounded-full bg-white/90 text-sky-600 flex items-center justify-center shadow-lg">
                            <Play className="w-4.5 h-4.5 fill-sky-600 ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <div className="p-3.5 space-y-2">
                        <h4 className="font-bold text-slate-800 text-xs line-clamp-1">{res.title}</h4>
                        <button
                          onClick={() => setActiveResourceModal(res)}
                          className="w-full px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Xem bài giảng</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {activeLinksList.map((link) => (
                    <div
                      key={link.id}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col justify-between"
                    >
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        <div className="relative aspect-video w-full bg-sky-50 overflow-hidden cursor-pointer flex items-center justify-center">
                          {link.thumbnailUrl ? (
                            <img
                              src={link.thumbnailUrl}
                              alt={link.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <ExternalLink className="w-12 h-12 text-sky-300" />
                          )}
                        </div>
                      </a>
                      <div className="p-3.5 space-y-2">
                        <h4 className="font-bold text-slate-800 text-xs line-clamp-1">{link.title}</h4>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Mở link</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {activeResourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="font-bold text-sm truncate">{activeResourceModal.title}</h4>
              <button
                onClick={() => setActiveResourceModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-black aspect-video flex items-center justify-center text-white">
              {(() => {
                const ytMatch = activeResourceModal.url.match(
                  /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{6,})/
                );
                if (ytMatch) {
                  return (
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`}
                      title={activeResourceModal.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  );
                }
                if (activeResourceModal.url) {
                  return (
                    <video src={activeResourceModal.url} controls autoPlay className="w-full h-full object-contain" />
                  );
                }
                return (
                  <div className="text-center space-y-2 p-6">
                    <Play className="w-12 h-12 text-sky-400 mx-auto" />
                    <p className="text-xs text-slate-300">Chưa có đường dẫn video cho bài giảng này</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Mini Game Modal */}
      {isGameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
                  🎮
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Góc Giải Trí Tin Học</h3>
                  <p className="text-[11px] text-slate-500">
                    Trò chơi luyện gõ 10 ngón phím và thử thách trí tuệ máy tính vui nhộn
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGameModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {activeGamesList.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto text-2xl">
                    🕹️
                  </div>
                  <p className="text-slate-500 text-xs">
                    Hiện chưa có trò chơi nào được kích hoạt. Hãy đón chờ thầy cô mở game nhé!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeGamesList.map((game) => (
                    <div
                      key={game.id}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md hover:border-purple-300 transition-all flex flex-col justify-between"
                    >
                      <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                        <img
                          src={
                            game.thumbnailUrl ||
                            'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80'
                          }
                          alt={game.title}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300 opacity-90"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="p-3.5 space-y-2">
                        <h4 className="font-bold text-slate-800 text-xs line-clamp-1">{game.title}</h4>
                        <button
                          onClick={() => {
                            if (!game.url) {
                              alert('Liên kết trò chơi không hợp lệ hoặc đã bị gỡ.');
                              return;
                            }
                            try {
                              const validUrl = new URL(game.url);
                              window.open(validUrl.toString(), '_blank', 'noopener,noreferrer');
                            } catch {
                              alert('Không thể mở trò chơi: Địa chỉ web không hợp lệ.');
                            }
                          }}
                          className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Chơi trò chơi</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setIsGameModalOpen(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
