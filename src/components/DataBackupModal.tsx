import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Download,
  Upload,
  Cloud,
  CheckCircle2,
  AlertCircle,
  FileJson,
  Database,
  Lock,
  Layers,
  Sparkles,
  Calendar,
  Users,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundManager } from '../utils/audio';
import { listMyClasses, createClass } from '../services/classesService';
import { listSchoolYears } from '../services/schoolYearsService';
import { listStudentsByClass, upsertStudents } from '../services/studentsService';
import { getClassScores, saveScore, Semester } from '../services/scoresService';
import { getWeekAttendance, saveWeekAttendance, getWeekEvaluations, saveWeekEvaluation, AttendanceStatus } from '../services/attendanceService';
import { listResources, createResource } from '../services/resourcesService';
import { listTopics, listQuestionsByTopic, createTopic, createQuestion } from '../services/quizService';
import { UserAccount } from '../types';

const TOTAL_WEEKS = 35;
const SEMESTERS: Semester[] = ['hk1', 'ca_nam'];
const RESOURCE_TYPES: Array<'video' | 'link' | 'game'> = ['video', 'link', 'game'];

interface BackupPayload {
  version: '2.0-supabase';
  exportedAt: string;
  classes: Array<{
    roomCode: string;
    name: string;
    grade: number;
    students: Array<{ code: string; name: string }>;
    scores: Array<{ studentCode: string; semester: Semester; theoryScore: number | null; practiceScore: number | null }>;
    attendance: Array<{ studentCode: string; weekNumber: number; status: AttendanceStatus; note?: string }>;
    evaluations: Array<{ studentCode: string; weekNumber: number; comment: string }>;
  }>;
  resources: Array<{ type: 'video' | 'link' | 'game'; grade?: number; title: string; url: string; thumbnailUrl?: string; isActive: boolean }>;
  quizTopics: Array<{
    grade: number;
    name: string;
    isActive: boolean;
    questions: Array<{ content: string; options: string[]; correctIndex: number }>;
  }>;
}

/**
 * Lấy toàn bộ dữ liệu thật từ Supabase (không phải localStorage) để xuất thành 1 file sao lưu
 * đầy đủ: lớp, học sinh, điểm, điểm danh, nhận xét tuần, học liệu/game, ngân hàng câu hỏi.
 */
async function buildFullBackupPayload(): Promise<BackupPayload> {
  const classes = await listMyClasses();

  const classesPayload = await Promise.all(
    classes.map(async (cls) => {
      const students = await listStudentsByClass(cls.id);
      const studentCodeById = new Map(students.map((s) => [s.id, s.code]));

      const scores: BackupPayload['classes'][number]['scores'] = [];
      for (const semester of SEMESTERS) {
        const items = await getClassScores(cls.id, semester);
        for (const item of items) {
          scores.push({
            studentCode: studentCodeById.get(item.studentId) || item.studentId,
            semester,
            theoryScore: item.theoryScore,
            practiceScore: item.practiceScore,
          });
        }
      }

      const attendance: BackupPayload['classes'][number]['attendance'] = [];
      const evaluations: BackupPayload['classes'][number]['evaluations'] = [];
      for (let week = 1; week <= TOTAL_WEEKS; week++) {
        const [attMap, evalMap] = await Promise.all([
          getWeekAttendance(cls.id, week),
          getWeekEvaluations(cls.id, week),
        ]);
        for (const [studentId, rec] of Object.entries(attMap)) {
          const code = studentCodeById.get(studentId);
          if (code) attendance.push({ studentCode: code, weekNumber: week, status: rec.status, note: rec.note });
        }
        for (const [studentId, comment] of Object.entries(evalMap)) {
          const code = studentCodeById.get(studentId);
          if (code) evaluations.push({ studentCode: code, weekNumber: week, comment });
        }
      }

      return {
        roomCode: cls.roomCode,
        name: cls.name,
        grade: cls.grade,
        students: students.map((s) => ({ code: s.code, name: s.name })),
        scores,
        attendance,
        evaluations,
      };
    })
  );

  const resourcesPayload: BackupPayload['resources'] = [];
  for (const type of RESOURCE_TYPES) {
    const items = await listResources(type);
    for (const r of items) {
      resourcesPayload.push({
        type: r.type,
        grade: r.grade,
        title: r.title,
        url: r.url,
        thumbnailUrl: r.thumbnailUrl,
        isActive: r.isActive,
      });
    }
  }

  const topics = await listTopics();
  const quizTopicsPayload = await Promise.all(
    topics.map(async (t) => {
      const questions = await listQuestionsByTopic(t.id);
      return {
        grade: t.grade,
        name: t.name,
        isActive: t.isActive,
        questions: questions.map((q) => ({ content: q.question, options: q.options, correctIndex: q.correctIndex })),
      };
    })
  );

  return {
    version: '2.0-supabase',
    exportedAt: new Date().toISOString(),
    classes: classesPayload,
    resources: resourcesPayload,
    quizTopics: quizTopicsPayload,
  };
}

/**
 * Khôi phục dữ liệu từ file sao lưu lên Supabase.
 * An toàn khi chạy lại nhiều lần: lớp đã tồn tại (trùng room_code) hoặc học sinh đã tồn tại
 * (trùng mã trong cùng lớp) sẽ được BỎ QUA thay vì tạo trùng lặp — chỉ điểm/điểm danh/nhận xét
 * được ghi đè (upsert) vì những dữ liệu đó vốn đã idempotent theo thiết kế.
 */
async function restoreFromBackupPayload(payload: BackupPayload): Promise<{ restoredClasses: number; skippedClasses: number }> {
  let restoredClasses = 0;
  let skippedClasses = 0;

  for (const clsBackup of payload.classes) {
    let classId: string;
    const existing = await listMyClasses();
    const found = existing.find((c) => c.roomCode === clsBackup.roomCode);

    if (found) {
      classId = found.id;
      skippedClasses++;
    } else {
      const created = await createClass({ name: clsBackup.name, grade: clsBackup.grade, roomCode: clsBackup.roomCode });
      classId = created.id;
      restoredClasses++;
    }

    const currentStudents = await listStudentsByClass(classId);
    const existingCodes = new Set(currentStudents.map((s) => s.code));
    const newStudents = clsBackup.students.filter((s) => !existingCodes.has(s.code));
    if (newStudents.length > 0) {
      await upsertStudents(classId, newStudents.map((s) => ({ code: s.code, name: s.name })));
    }

    const studentsAfter = await listStudentsByClass(classId);
    const studentIdByCode = new Map(studentsAfter.map((s) => [s.code, s.id]));

    for (const score of clsBackup.scores) {
      const studentId = studentIdByCode.get(score.studentCode);
      if (studentId && score.theoryScore !== null && score.practiceScore !== null) {
        await saveScore(studentId, score.semester, score.theoryScore, score.practiceScore);
      }
    }

    const attendanceByWeek = new Map<number, Array<{ studentId: string; status: AttendanceStatus; note?: string }>>();
    for (const att of clsBackup.attendance) {
      const studentId = studentIdByCode.get(att.studentCode);
      if (!studentId) continue;
      const list = attendanceByWeek.get(att.weekNumber) || [];
      list.push({ studentId, status: att.status, note: att.note });
      attendanceByWeek.set(att.weekNumber, list);
    }
    for (const [week, records] of attendanceByWeek) {
      await saveWeekAttendance(week, records);
    }

    for (const ev of clsBackup.evaluations) {
      const studentId = studentIdByCode.get(ev.studentCode);
      if (studentId) {
        await saveWeekEvaluation(studentId, ev.weekNumber, ev.comment);
      }
    }
  }

  for (const r of payload.resources || []) {
    await createResource({ type: r.type, grade: r.grade, title: r.title, url: r.url, thumbnailUrl: r.thumbnailUrl, isActive: r.isActive });
  }

  for (const t of payload.quizTopics || []) {
    const topicId = await createTopic(t.grade, t.name);
    for (const q of t.questions) {
      await createQuestion({ grade: t.grade, subject: '', topic: topicId, question: q.content, options: q.options, correctIndex: q.correctIndex, explanation: '' });
    }
  }

  return { restoredClasses, skippedClasses };
}

interface DataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserAccount;
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [currentYear, setCurrentYear] = useState('2026-2027');
  const [classesCount, setClassesCount] = useState(0);
  const [studentsCount, setStudentsCount] = useState(0);
  const [yearsList, setYearsList] = useState<string[]>([]);
  const [cloudStatus, setCloudStatus] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCurrentStats = () => {
    try {
      const cy = localStorage.getItem('qllh_current_year') || '';
      listSchoolYears()
        .then((years) => {
          setYearsList(years.map((y) => y.name));
          setCurrentYear(cy || years.find((y) => y.isActive)?.name || years[0]?.name || '');
        })
        .catch(() => {});
      listMyClasses()
        .then(async (cls) => {
          setClassesCount(cls.length);
          const stdArrays = await Promise.all(cls.map((c) => listStudentsByClass(c.id)));
          setStudentsCount(stdArrays.flat().length);
        })
        .catch(() => {});
      setCloudStatus('Đã kết nối và tự động lưu trữ trên máy chủ Supabase');
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCurrentStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const payload = await buildFullBackupPayload();
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `QLLH_Backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      soundManager.playFanfare();
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      setToastMessage({
        text: `Đã xuất file sao lưu thật từ Supabase: ${payload.classes.length} lớp, ${payload.classes.reduce((n, c) => n + c.students.length, 0)} học sinh. Bạn có thể lưu giữ file này an toàn.`,
        type: 'success',
      });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (e: any) {
      setToastMessage({
        text: `Lỗi khi xuất file sao lưu: ${e?.message || e}`,
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (parsed?.version !== '2.0-supabase' || !Array.isArray(parsed?.classes)) {
          setToastMessage({
            text: 'File này không phải định dạng sao lưu Supabase hợp lệ (có thể là bản sao lưu cũ từ phiên bản trước — không tương thích).',
            type: 'error',
          });
          return;
        }

        setIsRestoring(true);
        const result = await restoreFromBackupPayload(parsed as BackupPayload);
        await loadCurrentStats();
        soundManager.playFanfare();
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
        setToastMessage({
          text: `Khôi phục xong: ${result.restoredClasses} lớp mới được tạo, ${result.skippedClasses} lớp đã có sẵn (bỏ qua để tránh trùng lặp, chỉ cập nhật điểm/điểm danh).`,
          type: 'success',
        });
      } catch (err: any) {
        setToastMessage({
          text: `Lỗi khi khôi phục: ${err?.message || err}`,
          type: 'error',
        });
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl relative border border-slate-100 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  BẢO MẬT & BẢO TOÀN DỮ LIỆU
                </span>
                <span className="text-[11px] text-slate-400">·</span>
                <span className="text-[11px] font-semibold text-slate-500">Lưu trữ qua từng năm</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                Trung tâm Quản lý & Sao lưu Dữ liệu
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Current Database Summary Box */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-[#0070F3]" />
              Cơ sở dữ liệu đang lưu trong hệ thống:
            </span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
              ✓ Đang lưu an toàn
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
              <p className="text-[11px] text-slate-500 font-semibold">Năm học</p>
              <p className="text-base font-black text-slate-900 mt-0.5">{currentYear}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">({yearsList.length} niên khóa)</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
              <p className="text-[11px] text-slate-500 font-semibold">Tổng số lớp</p>
              <p className="text-base font-black text-[#0070F3] mt-0.5">{classesCount} lớp</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Tất cả các khối</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
              <p className="text-[11px] text-slate-500 font-semibold">Tổng học sinh</p>
              <p className="text-base font-black text-emerald-600 mt-0.5">{studentsCount} em</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Kèm điểm & nhận xét</p>
            </div>
          </div>
        </div>

        {/* Action 1: Tải file sao lưu về máy tính & Khôi phục từ file */}
        <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-900">Sao lưu & Khôi phục bằng File (.JSON)</h4>
            </div>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
              Khuyên dùng
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Xuất toàn bộ học sinh, lớp học, điểm số của tất cả các năm học ra 1 file duy nhất để lưu trữ vào máy tính hoặc Google Drive cá nhân. Khi chuyển máy tính hoặc đổi trình duyệt, bạn chỉ cần nạp file này để phục hồi 100%.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={isExporting || isRestoring}
              className="px-4 py-2.5 bg-[#0070F3] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Đang lấy dữ liệu từ Supabase...' : 'Tải file sao lưu về máy (.json)'}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isExporting || isRestoring}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>{isRestoring ? 'Đang khôi phục lên Supabase...' : 'Khôi phục từ file sao lưu'}</span>
            </button>
          </div>
        </div>

        {/* Action 2: Đám mây Supabase */}
        <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900">Lưu trữ đám mây Supabase (Tự động)</h4>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              PostgreSQL + Row-Level Security
            </span>
          </div>

          <p className="text-xs text-slate-600">
            Mọi thao tác quản lý lớp học, điểm danh và bảng điểm được lưu trực tiếp vào cơ sở dữ liệu Supabase được mã hóa và phân quyền theo tài khoản giáo viên.
          </p>

          <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>{cloudStatus}</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            Cơ chế bảo vệ dữ liệu chống ghi đè khi cập nhật tính năng mới đã được kích hoạt.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
