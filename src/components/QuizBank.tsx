import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Plus,
  CheckCircle2,
  XCircle,
  HelpCircle,
  X,
  BookOpen,
  FileSpreadsheet,
  Trash2,
  Pencil,
  Search,
  Filter,
  Eye,
  Award,
  RefreshCw,
  Trophy,
  Check,
  Calendar,
  Upload,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { QuizQuestion, QuizSubmission } from '../types';
import { soundManager } from '../utils/audio';
import {
  listTopics,
  listAllQuestions,
  createQuestion,
  deleteQuestion,
  listExamResults,
  deleteExamResult,
  createTopic,
  updateQuestion,
  generateSampleExcelTemplate,
  parseQuestionsExcelFile,
  bulkInsertQuestions,
  QuizTopicItem,
} from '../services/quizService';
import { uploadQuestionImage } from '../services/quizImageService';
import { QuizTopicActivationPanel } from './QuizTopicActivationPanel';

interface QuizBankProps {
  isAdmin?: boolean;
}

function formatSubmittedAt(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const QuizBank: React.FC<QuizBankProps> = ({ isAdmin = true }) => {
  // Ngân hàng câu hỏi thật (từ Supabase quiz_questions/quiz_topics), không còn dùng localStorage
  const [quizzes, setQuizzes] = useState<QuizQuestion[]>([]);
  const [allTopics, setAllTopics] = useState<QuizTopicItem[]>([]);

  const refreshQuestionBank = async () => {
    try {
      const [topics, questions] = await Promise.all([listTopics(), listAllQuestions()]);
      setAllTopics(topics);
      setQuizzes(questions);
    } catch (err: any) {
      console.error('Lỗi tải ngân hàng câu hỏi:', err);
    }
  };

  useEffect(() => {
    refreshQuestionBank();
  }, []);
  // Main sub-tabs in QuizBank: 'bank' (Ngân hàng câu hỏi) or 'scores' (Bảng điểm học sinh)
  const [activeSubTab, setActiveSubTab] = useState<'bank' | 'scores'>('bank');

  // Filter grade in bank: all or 1, 2, 3, 4, 5
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Submissions State (Scores of students) — luôn lấy thật từ Supabase, không mock/localStorage
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);

  const refreshSubmissions = () => {
    listExamResults()
      .then((results) => setSubmissions(results))
      .catch(() => {});
  };

  // Tải kết quả thi học sinh từ Supabase quiz_results join quiz_sessions, và tải lại
  // mỗi khi có học sinh nộp bài/dữ liệu cập nhật từ máy khác
  useEffect(() => {
    refreshSubmissions();
    window.addEventListener('qllh_data_updated', refreshSubmissions);
    return () => window.removeEventListener('qllh_data_updated', refreshSubmissions);
  }, []);

  // Scores filter state
  const [scoreGradeFilter, setScoreGradeFilter] = useState<number | 'all'>('all');
  const [scoreClassFilter, setScoreClassFilter] = useState<string>('all');
  const [searchStudentName, setSearchStudentName] = useState('');
  const [selectedSubmissionDetail, setSelectedSubmissionDetail] = useState<QuizSubmission | null>(null);

  // New question form state
  const [newGrade, setNewGrade] = useState(4);
  const [newTopicChoice, setNewTopicChoice] = useState<string>(''); // id của chủ đề đã có, hoặc '__new__'
  const [newTopicName, setNewTopicName] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState(['', '', '', '']);
  const [newCorrectIndex, setNewCorrectIndex] = useState(0);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  // null = dang them cau hoi moi; co id = dang sua cau hoi da co (khong doi duoc khoi/chu de)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // Mỗi khi đổi khối lớp trong form thêm câu hỏi, reset lựa chọn chủ đề (vì chủ đề phụ thuộc khối).
  // Bỏ qua khi đang MỞ form sửa 1 câu hỏi có sẵn (openEditQuestion đổi newGrade + newTopicChoice
  // cùng lúc để nạp sẵn dữ liệu) - nếu không sẽ bị effect này xoá mất chủ đề vừa nạp.
  useEffect(() => {
    if (editingQuestionId) return;
    setNewTopicChoice('');
    setNewTopicName('');
  }, [newGrade]);

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  const filteredQuizzes = quizzes.filter(
    (q) =>
      (selectedGrade === 'all' || q.grade === selectedGrade) &&
      (!selectedTopicId || q.topic === selectedTopicId)
  );

  const handleNewImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploadError('');
    const objectUrl = URL.createObjectURL(file);
    setNewImagePreview(objectUrl);
    setNewImageUrl('');
    setIsUploadingImage(true);
    try {
      const result = await uploadQuestionImage(file);
      if ('error' in result) {
        setImageUploadError(result.error);
        setNewImagePreview(null);
      } else {
        setNewImageUrl(result.url);
      }
    } finally {
      setIsUploadingImage(false);
    }
  };

  const resetQuestionForm = () => {
    setShowAddModal(false);
    setEditingQuestionId(null);
    setNewQuestion('');
    setNewOptions(['', '', '', '']);
    setNewTopicChoice('');
    setNewTopicName('');
    setNewImagePreview(null);
    setNewImageUrl('');
    setImageUploadError('');
  };

  const openEditQuestion = (quiz: QuizQuestion) => {
    setEditingQuestionId(quiz.id);
    setNewGrade(quiz.grade);
    setNewTopicChoice(quiz.topic);
    setNewQuestion(quiz.question);
    setNewOptions(quiz.options.length === 4 ? [...quiz.options] : ['', '', '', '']);
    setNewCorrectIndex(quiz.correctIndex);
    setNewImageUrl(quiz.imageUrl || '');
    setNewImagePreview(quiz.imageUrl || null);
    setImageUploadError('');
    setShowAddModal(true);
  };

  const handleAddQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    if (!newTopicChoice) {
      alert('Vui lòng chọn chủ đề bài học.');
      return;
    }

    try {
      const payload = {
        grade: newGrade,
        subject: 'Tin học',
        topic: newTopicChoice,
        question: newQuestion.trim(),
        options: newOptions.map((opt, i) => opt.trim() || `Đáp án ${String.fromCharCode(65 + i)}`),
        correctIndex: newCorrectIndex,
        explanation: '',
        imageUrl: newImageUrl || undefined,
      };

      if (editingQuestionId) {
        await updateQuestion(editingQuestionId, payload);
      } else {
        let topicId = newTopicChoice;
        if (newTopicChoice === '__new__') {
          const topicName = newTopicName.trim() || 'Chủ đề chung';
          topicId = await createTopic(newGrade, topicName);
        }
        await createQuestion({ ...payload, topic: topicId });
      }

      await refreshQuestionBank();
      resetQuestionForm();
      soundManager.playFanfare();
    } catch (err: any) {
      alert(`Không thể lưu câu hỏi: ${err.message || 'Lỗi không xác định'}`);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Thầy có chắc chắn muốn xóa câu hỏi này không?')) return;
    try {
      await deleteQuestion(id);
      await refreshQuestionBank();
      soundManager.playTick();
    } catch (err: any) {
      alert(`Không thể xóa câu hỏi: ${err.message || 'Lỗi không xác định'}`);
    }
  };

  // Delete a student's submission record
  const handleDeleteSubmission = async (sub: QuizSubmission) => {
    if (!confirm('Thầy có chắc chắn muốn xóa kết quả bài thi này của học sinh?')) return;
    if (!sub.sessionId) return;
    try {
      await deleteExamResult(sub.sessionId);
      setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
      soundManager.playTick();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa kết quả thi');
    }
  };

  // Filter student submissions
  const filteredSubmissions = submissions.filter((sub) => {
    if (scoreGradeFilter !== 'all' && sub.grade !== scoreGradeFilter) return false;
    if (scoreClassFilter !== 'all' && sub.className !== scoreClassFilter) return false;
    if (searchStudentName.trim()) {
      const q = searchStudentName.toLowerCase();
      if (!sub.studentName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Calculate distinct classes from submissions
  const availableClasses = Array.from(
    new Set(submissions.map((s) => s.className).filter(Boolean))
  );

  // Statistics
  const totalSubmissions = submissions.length;
  const avgScore =
    totalSubmissions > 0
      ? (submissions.reduce((acc, s) => acc + s.score, 0) / totalSubmissions).toFixed(1)
      : '0.0';
  const goodCount = submissions.filter((s) => s.score >= 9).length;
  const goodRate =
    totalSubmissions > 0 ? Math.round((goodCount / totalSubmissions) * 100) : 0;

  const handleDownloadSample = () => {
    const blob = generateSampleExcelTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_cau_hoi_trac_nghiem.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ======= Popup nhập file Excel theo 3 bước: chọn khối -> chọn/tạo chủ đề -> chọn file =======
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importGrade, setImportGrade] = useState<number>(1);
  const [importTopicChoice, setImportTopicChoice] = useState<string>(''); // id chủ đề có sẵn, hoặc '__new__'
  const [importNewTopicName, setImportNewTopicName] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const openImportModal = () => {
    setImportStep(1);
    setImportGrade(typeof selectedGrade === 'number' ? selectedGrade : 1);
    setImportTopicChoice('');
    setImportNewTopicName('');
    setShowImportModal(true);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
  };

  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);

      // Xác định chủ đề đích đã chọn/tạo ở bước 2, luôn thuộc đúng khối đã chọn ở bước 1
      let targetTopicId = importTopicChoice;
      if (importTopicChoice === '__new__') {
        const name = importNewTopicName.trim();
        if (!name) {
          alert('Vui lòng nhập tên chủ đề mới.');
          return;
        }
        targetTopicId = await createTopic(importGrade, name);
      }

      if (!targetTopicId) {
        alert('Vui lòng chọn chủ đề để nhập câu hỏi.');
        return;
      }

      // An toàn: tuyệt đối không nhập vào chủ đề của khối khác
      const topicsList = await listTopics();
      const targetTopic = topicsList.find((t) => t.id === targetTopicId);
      if (!targetTopic || targetTopic.grade !== importGrade) {
        alert('Lỗi: Chủ đề được chọn không thuộc khối lớp đã chọn. Vui lòng thử lại.');
        return;
      }

      const parsed = await parseQuestionsExcelFile(file);
      if ('error' in parsed) {
        alert(parsed.error);
        return;
      }

      await bulkInsertQuestions(targetTopicId, parsed.rows);
      alert(`Nhập thành công ${parsed.rows.length} câu hỏi vào Khối ${importGrade}!`);
      await refreshQuestionBank();
      closeImportModal();
    } catch (err: any) {
      alert(`Lỗi khi nhập Excel: ${err.message}`);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  // Export submissions to Excel
  const handleExportToExcel = () => {
    if (filteredSubmissions.length === 0) {
      alert('Không có dữ liệu bài thi để xuất file!');
      return;
    }

    const exportRows = filteredSubmissions.map((sub, index) => {
      const classification =
        sub.score >= 9
          ? 'Hoàn thành Tốt (T)'
          : sub.score >= 5
          ? 'Hoàn thành (H)'
          : 'Chưa hoàn thành (C)';

      const mins = Math.floor(sub.durationSeconds / 60);
      const secs = sub.durationSeconds % 60;
      const durationStr = `${mins} phút ${secs} giây`;

      return {
        'STT': index + 1,
        'Họ và tên học sinh': sub.studentName,
        'Lớp': sub.className || 'Tự do',
        'Khối lớp': `Khối ${sub.grade}`,
        'Điểm số (Thang 10)': sub.score,
        'Số câu đúng': `${sub.correctAnswers}/${sub.totalQuestions}`,
        'Xếp loại': classification,
        'Thời gian làm bài': durationStr,
        'Thời gian nộp': formatSubmittedAt(sub.submittedAt)
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ket_Qua_Trac_Nghiem');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Bang_Diem_Trac_Nghiem_Tin_Hoc_${dateStr}.xlsx`);
    soundManager.playFanfare();
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Banner with Sub-Tab Navigation */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md">
              Kiến thức tin học
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-medium">Bộ sách Kết nối tri thức</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
            Trắc nghiệm & Đánh giá học sinh
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý ngân hàng câu hỏi và theo dõi bảng điểm kiểm tra trực tuyến của học sinh
          </p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl gap-1 shrink-0">
          <button
            onClick={() => setActiveSubTab('bank')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'bank'
                ? 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Ngân hàng câu hỏi ({quizzes.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('scores')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 relative ${
              activeSubTab === 'scores'
                ? 'bg-white text-sky-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Bảng điểm học sinh thi</span>
            {submissions.length > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-bold">
                {submissions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SUB-TAB 1: NGÂN HÀNG CÂU HỎI TRẮC NGHIỆM */}
      {/* ======================================================== */}
      {activeSubTab === 'bank' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Action Bar & Grade filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            {/* Grade selector dropdown */}
            <div className="flex items-center gap-1.5">
              <select
                value={selectedGrade}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedGrade(value === 'all' ? 'all' : Number(value));
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-transparent focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">Tất cả các khối</option>
                <option value={1}>Khối lớp 1</option>
                <option value={2}>Khối lớp 2</option>
                <option value={3}>Khối lớp 3</option>
                <option value={4}>Khối lớp 4</option>
                <option value={5}>Khối lớp 5</option>
              </select>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && (
                <>
                  <button
                    onClick={handleDownloadSample}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    title="Tải file mẫu Excel câu hỏi trắc nghiệm"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Tải file mẫu</span>
                  </button>

                  <button
                    onClick={openImportModal}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Nhập file Excel</span>
                  </button>

                  <button
                    onClick={() => {
                      resetQuestionForm();
                      setShowAddModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm câu hỏi mới</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Panel Quản lý & Kích hoạt chủ đề */}
          <QuizTopicActivationPanel
            grade={selectedGrade}
            selectedTopicId={selectedTopicId}
            onSelectTopic={setSelectedTopicId}
          />

          {/* Question Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredQuizzes.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                <p className="text-slate-400 text-sm">Chưa có câu hỏi nào cho khối lớp này.</p>
                <button
                  onClick={() => {
                    resetQuestionForm();
                    setShowAddModal(true);
                  }}
                  className="mt-3 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl"
                >
                  + Thêm câu hỏi ngay
                </button>
              </div>
            ) : (
              filteredQuizzes.map((quiz, qIdx) => (
                <div
                  key={quiz.id}
                  className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg">
                        Khối {quiz.grade}
                      </span>
                      <span className="truncate max-w-[200px] text-slate-500">{quiz.topicName || quiz.topic}</span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm leading-snug">
                      <span className="text-emerald-600 mr-1.5">Câu {qIdx + 1}:</span>
                      {quiz.question}
                    </h4>

                    {quiz.imageUrl && (
                      <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 max-h-48">
                        <img
                          src={quiz.imageUrl}
                          alt={`Hình minh họa câu ${qIdx + 1}`}
                          className="w-full h-full object-contain bg-slate-50"
                        />
                      </div>
                    )}

                    <div className="mt-3 space-y-1.5">
                      {quiz.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between ${
                            oIdx === quiz.correctIndex
                              ? 'bg-emerald-50/80 border border-emerald-300 text-emerald-900 font-semibold'
                              : 'bg-slate-50 text-slate-600'
                          }`}
                        >
                          <span>
                            <strong className="mr-2 text-slate-400">
                              {String.fromCharCode(65 + oIdx)}.
                            </strong>
                            {opt}
                          </span>
                          {oIdx === quiz.correctIndex && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end text-xs">
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openEditQuestion(quiz)}
                            className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                            title="Sửa câu hỏi"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(quiz.id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                            title="Xóa câu hỏi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 2: BẢNG ĐIỂM & LỊCH SỬ HỌC SINH THI TRẮC NGHIỆM */}
      {/* ======================================================== */}
      {activeSubTab === 'scores' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Tổng bài thi</span>
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">📝</span>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2">{totalSubmissions}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Lượt học sinh đã nộp</p>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Điểm trung bình</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">🎯</span>
              </div>
              <p className="text-2xl font-black text-emerald-600 mt-2">{avgScore} / 10</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Thang điểm 10</p>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Đạt Tốt (T)</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600">🏆</span>
              </div>
              <p className="text-2xl font-black text-amber-600 mt-2">{goodRate}%</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{goodCount} học sinh đạt ≥ 9đ</p>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Đồng bộ đám mây</span>
                <span className="p-2 rounded-xl bg-sky-50 text-sky-600">☁️</span>
              </div>
              <p className="text-xs font-bold text-sky-700 mt-2">Supabase</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Tự động lưu & xem mọi máy</p>
            </div>
          </div>

          {/* Filter Bar & Export Excel */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search Name */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm tên học sinh..."
                  value={searchStudentName}
                  onChange={(e) => setSearchStudentName(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-sky-500 w-44"
                />
              </div>

              {/* Grade Filter */}
              <select
                value={scoreGradeFilter}
                onChange={(e) =>
                  setScoreGradeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-700"
              >
                <option value="all">Tất cả Khối</option>
                <option value={1}>Khối 1</option>
                <option value={2}>Khối 2</option>
                <option value={3}>Khối 3</option>
                <option value={4}>Khối 4</option>
                <option value={5}>Khối 5</option>
              </select>

              {/* Class Filter */}
              {availableClasses.length > 0 && (
                <select
                  value={scoreClassFilter}
                  onChange={(e) => setScoreClassFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-700"
                >
                  <option value="all">Tất cả các lớp</option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Export Excel Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportToExcel}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Xuất file Excel</span>
              </button>
            </div>
          </div>

          {/* Scores Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">STT</th>
                    <th className="py-3 px-4">Họ và tên học sinh</th>
                    <th className="py-3 px-3 text-center">Lớp</th>
                    <th className="py-3 px-3 text-center">Khối</th>
                    <th className="py-3 px-3 text-center">Điểm số</th>
                    <th className="py-3 px-3 text-center">Số câu đúng</th>
                    <th className="py-3 px-3 text-center">Xếp loại</th>
                    <th className="py-3 px-3 text-center">Thời gian</th>
                    <th className="py-3 px-4">Ngày nộp</th>
                    <th className="py-3 px-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        Chưa có bài nộp nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub, idx) => {
                      const isTop = sub.score >= 9;
                      const isPass = sub.score >= 5;

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 text-center text-slate-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {sub.studentName}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                              {sub.className || 'Tự do'}
                            </span>
                            {sub.schoolName && (
                              <span className="block text-[10px] text-slate-400 mt-0.5">{sub.schoolName}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-bold text-sky-700">Khối {sub.grade}</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg font-black text-sm ${
                                isTop
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isPass
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {sub.score}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-slate-700">
                            {sub.correctAnswers} / {sub.totalQuestions}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                                isTop
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isPass
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {isTop ? 'Tốt (T)' : isPass ? 'Đạt (H)' : 'Chưa đạt (C)'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center text-slate-500 font-mono text-[11px]">
                            {Math.floor(sub.durationSeconds / 60)}p {sub.durationSeconds % 60}s
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                            {formatSubmittedAt(sub.submittedAt)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {sub.details && (
                                <button
                                  onClick={() => setSelectedSubmissionDetail(sub)}
                                  className="p-1 rounded-lg text-sky-600 hover:bg-sky-50"
                                  title="Xem chi tiết bài làm"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteSubmission(sub)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                title="Xóa kết quả này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Detail Submission Modal */}
      {selectedSubmissionDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-sky-50">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  Bài thi của em: {selectedSubmissionDetail.studentName}
                </h3>
                <p className="text-xs text-slate-500">
                  Lớp {selectedSubmissionDetail.className || 'Tự do'} · Điểm:{' '}
                  <strong className="text-sky-700">{selectedSubmissionDetail.score} / 10</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedSubmissionDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              {selectedSubmissionDetail.details?.map((d, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-2xl border text-xs space-y-1 ${
                    d.isCorrect
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-rose-50/50 border-rose-200'
                  }`}
                >
                  <p className="font-bold text-slate-800">
                    Câu {i + 1}: {d.question}
                  </p>
                  <p className="text-slate-600">
                    Học sinh chọn:{' '}
                    <strong>
                      {d.selectedOption >= 0 ? String.fromCharCode(65 + d.selectedOption) : 'Chưa làm'}
                    </strong>{' '}
                    · Đáp án đúng:{' '}
                    <strong className="text-emerald-700">
                      {String.fromCharCode(65 + d.correctOption)}
                    </strong>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Question Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 text-base">
              {editingQuestionId ? 'Sửa câu hỏi trắc nghiệm' : 'Thêm câu hỏi trắc nghiệm Tin học'}
            </h3>

            <form onSubmit={handleAddQuestionSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Khối lớp</label>
                  <select
                    value={newGrade}
                    onChange={(e) => setNewGrade(Number(e.target.value))}
                    disabled={!!editingQuestionId}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value={1}>Khối 1</option>
                    <option value={2}>Khối 2</option>
                    <option value={3}>Khối 3</option>
                    <option value={4}>Khối 4</option>
                    <option value={5}>Khối 5</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Chủ đề bài học</label>
                  <select
                    value={newTopicChoice}
                    onChange={(e) => setNewTopicChoice(e.target.value)}
                    disabled={!!editingQuestionId}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-400"
                    required
                  >
                    <option value="">-- Chọn chủ đề --</option>
                    {allTopics
                      .filter((t) => t.grade === newGrade)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    <option value="__new__">+ Tạo chủ đề mới</option>
                  </select>
                  {newTopicChoice === '__new__' && (
                    <input
                      type="text"
                      value={newTopicName}
                      onChange={(e) => setNewTopicName(e.target.value)}
                      placeholder="Nhập tên chủ đề mới"
                      className="w-full mt-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                      required
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nội dung câu hỏi</label>
                <textarea
                  rows={2}
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Nhập câu hỏi trắc nghiệm..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Hình ảnh minh họa (không bắt buộc)
                </label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Tải ảnh lên</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={handleNewImageFileChange}
                    />
                  </label>
                  {isUploadingImage && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Đang tải ảnh...
                    </span>
                  )}
                </div>
                {imageUploadError && (
                  <p className="text-xs text-rose-600 mt-1">{imageUploadError}</p>
                )}
                {newImagePreview && (
                  <div className="mt-2 relative max-w-[200px] rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={newImagePreview} alt="Xem trước" className="w-full h-auto object-contain" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">
                  4 Phương án trả lời (Chọn nút tròn để chỉ định đáp án đúng):
                </label>
                {newOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctChoice"
                      checked={newCorrectIndex === i}
                      onChange={() => setNewCorrectIndex(i)}
                      className="text-emerald-600"
                    />
                    <span className="text-xs font-bold text-slate-400 w-4">
                      {String.fromCharCode(65 + i)}:
                    </span>
                    <input
                      type="text"
                      placeholder={`Lựa chọn ${String.fromCharCode(65 + i)}`}
                      value={opt}
                      onChange={(e) => {
                        const copy = [...newOptions];
                        copy[i] = e.target.value;
                        setNewOptions(copy);
                      }}
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                      required
                    />
                  </div>
                ))}
              </div>


              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetQuestionForm}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  {editingQuestionId ? 'Lưu thay đổi' : 'Lưu câu hỏi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Excel Modal (3 bước: chọn khối -> chọn/tạo chủ đề -> chọn file) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base">Nhập câu hỏi từ file Excel</h3>
              <button
                onClick={closeImportModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
              <span className={importStep === 1 ? 'text-emerald-600' : ''}>1. Chọn khối</span>
              <span>›</span>
              <span className={importStep === 2 ? 'text-emerald-600' : ''}>2. Chọn chủ đề</span>
              <span>›</span>
              <span className={importStep === 3 ? 'text-emerald-600' : ''}>3. Chọn file</span>
            </div>

            {/* Step 1: chọn khối */}
            {importStep === 1 && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-600">Chọn khối lớp cần nhập câu hỏi</label>
                <select
                  value={importGrade}
                  onChange={(e) => setImportGrade(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value={1}>Khối 1</option>
                  <option value={2}>Khối 2</option>
                  <option value={3}>Khối 3</option>
                  <option value={4}>Khối 4</option>
                  <option value={5}>Khối 5</option>
                </select>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setImportTopicChoice('');
                      setImportStep(2);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    <span>Tiếp theo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: chọn / tạo chủ đề */}
            {importStep === 2 && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-600">
                  Chọn chủ đề của Khối {importGrade} để nhập câu hỏi vào, hoặc tạo chủ đề mới
                </label>
                <select
                  value={importTopicChoice}
                  onChange={(e) => setImportTopicChoice(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">-- Chọn chủ đề --</option>
                  {allTopics
                    .filter((t) => t.grade === importGrade)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  <option value="__new__">+ Tạo chủ đề mới</option>
                </select>
                {importTopicChoice === '__new__' && (
                  <input
                    type="text"
                    value={importNewTopicName}
                    onChange={(e) => setImportNewTopicName(e.target.value)}
                    placeholder="Nhập tên chủ đề mới"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                )}
                <div className="flex justify-between gap-2 pt-2">
                  <button
                    onClick={() => setImportStep(1)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Quay lại</span>
                  </button>
                  <button
                    onClick={() => {
                      if (!importTopicChoice) {
                        alert('Vui lòng chọn chủ đề hoặc tạo chủ đề mới.');
                        return;
                      }
                      if (importTopicChoice === '__new__' && !importNewTopicName.trim()) {
                        alert('Vui lòng nhập tên chủ đề mới.');
                        return;
                      }
                      setImportStep(3);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    <span>Tiếp theo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: chọn file Excel */}
            {importStep === 3 && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-600">
                  Chọn file Excel câu hỏi để nhập vào chủ đề đã chọn (Khối {importGrade})
                </label>
                <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{isImporting ? 'Đang nhập...' : 'Chọn file Excel (.xlsx, .xls)'}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    disabled={isImporting}
                    onChange={handleImportFileSelected}
                  />
                </label>
                {isImporting && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang xử lý file...
                  </span>
                )}
                <div className="flex justify-start gap-2 pt-2">
                  <button
                    onClick={() => setImportStep(2)}
                    disabled={isImporting}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Quay lại</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
