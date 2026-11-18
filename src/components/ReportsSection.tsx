import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Download,
  Search,
  Filter,
  BarChart3,
  Award,
  Users,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  X,
  CalendarCheck,
  MessageSquareText,
} from 'lucide-react';
import { StudentCommentsManager, sortStudentsLikeGradeTab } from './StudentCommentsManager';

import { UserAccount } from '../types';
import { listMyClasses } from '../services/classesService';
import { listStudentsByClass } from '../services/studentsService';
import { getClassScores, saveScore, getClassStats, ClassStats } from '../services/scoresService';
import { getAllCommentBanks, CommentBankEntry } from '../services/commentBankService';
import {
  getWeekRangeForTerm,
  getAttendanceSummaryForClasses,
  getStudentAttendanceHistory,
  resolveClassGrade,
  pickCommentBank,
  resolveClassification,
  StudentAttendanceSummary,
  StudentAttendanceWeek,
  TOTAL_WEEKS,
} from '../services/reportsExportService';
import { ClassificationPieChart } from './reports/ClassificationPieChart';
import { ScoreAttendanceBarChart } from './reports/ScoreAttendanceBarChart';
import { WarningBanner } from './reports/WarningBanner';

function rankBadgeClass(rank: string | undefined): string {
  if (rank === 'T') return 'bg-emerald-100 text-emerald-700';
  if (rank === 'H') return 'bg-blue-100 text-blue-700';
  if (rank === 'C') return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-500';
}

function rankTextClass(rank: string | undefined): string {
  if (rank === 'T') return 'text-emerald-600';
  if (rank === 'H') return 'text-blue-600';
  if (rank === 'C') return 'text-rose-600';
  return 'text-slate-400';
}

interface ClassItem {
  id: string;
  year: string;
  name: string;
  grade: string;
  bg?: string;
  createdBy?: string;
  createdByName?: string;
}

interface StudentRecord {
  id: string;
  classId: string;
  code: string;
  name: string;
  dob?: string;
  gender?: string;
  note?: string;
  orderIndex?: number;
}

interface GradeRecord {
  lt: string;
  th: string;
  total: string;
  rank: string;
}

interface ReportsSectionProps {
  isAdmin?: boolean;
  currentUser?: UserAccount;
}

export const ReportsSection: React.FC<ReportsSectionProps> = ({ isAdmin = true, currentUser }) => {
  // Classes list
  const [classesList, setClassesList] = useState<ClassItem[]>([]);

  // Students list
  const [studentsList, setStudentsList] = useState<StudentRecord[]>([]);

  // Grades data: { [studentId_term]: { lt, th, total, rank } }
  const [gradeData, setGradeData] = useState<Record<string, GradeRecord>>({});

  const loadClassesAndStudents = async () => {
    try {
      const cls = await listMyClasses();
      const mappedClasses: ClassItem[] = cls.map((c) => ({
        id: c.id,
        year: c.academicYear,
        name: c.name,
        grade: String(c.grade),
      }));
      setClassesList(mappedClasses);

      // Load all students for all classes
      const allStudentsPromises = cls.map((c) => listStudentsByClass(c.id));
      const allResults = await Promise.all(allStudentsPromises);
      const combinedStudents: StudentRecord[] = allResults.flatMap((stList) =>
        stList.map((s) => ({
          id: s.id,
          classId: s.classId,
          code: s.code,
          name: s.name,
          dob: s.dob,
          gender: s.gender,
        }))
      );
      setStudentsList(combinedStudents);
    } catch (err) {
      console.error('Lỗi tải dữ liệu báo cáo:', err);
    }
  };

  useEffect(() => {
    loadClassesAndStudents();
    window.addEventListener('qllh_data_updated', loadClassesAndStudents);
    return () => window.removeEventListener('qllh_data_updated', loadClassesAndStudents);
  }, [currentUser?.id]);

  // Filter states
  // 'all' or specific class ID
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  // 'hk1' (Học kỳ 1) or 'hk2' (Cả năm)
  const [selectedTerm, setSelectedTerm] = useState<'hk1' | 'hk2'>('hk1');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCommentsModal, setShowCommentsModal] = useState(false);

  // Ngân hàng nhận xét T/H theo Khối, tải thật từ Supabase (dùng để gán nhận xét tổng hợp)
  const [commentBankT, setCommentBankT] = useState<Record<string, CommentBankEntry>>({});
  const [commentBankH, setCommentBankH] = useState<Record<string, CommentBankEntry>>({});

  const loadCommentBanks = () => {
    Promise.all([getAllCommentBanks('T'), getAllCommentBanks('H')])
      .then(([banksT, banksH]) => {
        setCommentBankT(banksT);
        setCommentBankH(banksH);
      })
      .catch((err) => console.error('Lỗi tải ngân hàng nhận xét:', err));
  };

  useEffect(() => {
    loadCommentBanks();
    window.addEventListener('qllh_data_updated', loadCommentBanks);
    return () => window.removeEventListener('qllh_data_updated', loadCommentBanks);
  }, []);

  // Tổng hợp điểm danh (có mặt / vắng có phép / vắng không phép) theo học sinh, cho khoảng
  // tuần của Học kỳ 1 / Cả năm đang chọn — dùng cho dashboard tổng quan & xuất báo cáo tổng hợp.
  const [attendanceSummary, setAttendanceSummary] = useState<Record<string, StudentAttendanceSummary>>({});

  // Chi tiết học sinh đang xem (modal), kèm lịch sử điểm danh tải riêng khi mở modal.
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentRecord | null>(null);
  const [studentAttendanceHistory, setStudentAttendanceHistory] = useState<StudentAttendanceWeek[]>([]);
  const [loadingStudentDetail, setLoadingStudentDetail] = useState(false);

  // Báo cáo hiển thị tất cả các lớp (không lọc theo năm học vì màn này không có bộ chọn năm học)
  const yearClasses = classesList;

  // Tải điểm từ Supabase scoresService khi chọn lớp
  useEffect(() => {
    const termKey: 'hk1' | 'ca_nam' = selectedTerm === 'hk1' ? 'hk1' : 'ca_nam';
    if (selectedClassId !== 'all') {
      getClassScores(selectedClassId, termKey)
        .then((scores) => {
          if (!scores || scores.length === 0) return;
          setGradeData((prev) => {
            const next = { ...prev };
            for (const s of scores) {
              const key = `${s.studentId}_${selectedTerm}`;
              next[key] = {
                lt: s.theoryScore !== null ? String(s.theoryScore) : '',
                th: s.practiceScore !== null ? String(s.practiceScore) : '',
                total: s.totalScore !== null ? String(s.totalScore) : '',
                rank: s.classification || '',
              };
            }
            return next;
          });
        })
        .catch(() => {});
    } else if (yearClasses.length > 0) {
      Promise.all(yearClasses.map((c) => getClassScores(c.id, termKey).catch(() => [])))
        .then((results) => {
          setGradeData((prev) => {
            const next = { ...prev };
            results.flat().forEach((s) => {
              const key = `${s.studentId}_${selectedTerm}`;
              next[key] = {
                lt: s.theoryScore !== null ? String(s.theoryScore) : '',
                th: s.practiceScore !== null ? String(s.practiceScore) : '',
                total: s.totalScore !== null ? String(s.totalScore) : '',
                rank: s.classification || '',
              };
            });
            return next;
          });
        })
        .catch(() => {});
    }
  }, [selectedClassId, selectedTerm, yearClasses]);

  // Selected class object
  const currentSelectedClass = useMemo(() => {
    if (selectedClassId === 'all') return null;
    return classesList.find((c) => c.id === selectedClassId) || null;
  }, [selectedClassId, classesList]);

  // Tải tổng hợp điểm danh thật từ Supabase theo đúng khoảng tuần của Học kỳ 1 / Cả năm
  useEffect(() => {
    const { start, end } = getWeekRangeForTerm(selectedTerm);
    const classIds =
      selectedClassId !== 'all'
        ? [selectedClassId]
        : (yearClasses.length > 0 ? yearClasses : classesList).map((c) => c.id);

    if (classIds.length === 0) {
      setAttendanceSummary({});
      return;
    }

    getAttendanceSummaryForClasses(classIds, start, end)
      .then(setAttendanceSummary)
      .catch((err) => {
        console.error('Lỗi tải tổng hợp điểm danh:', err);
        setAttendanceSummary({});
      });
  }, [selectedClassId, selectedTerm, yearClasses, classesList]);

  // Tải lịch sử điểm danh riêng cho học sinh đang xem chi tiết (modal)
  useEffect(() => {
    if (!selectedStudentDetail) {
      setStudentAttendanceHistory([]);
      return;
    }
    const { start, end } = getWeekRangeForTerm(selectedTerm);
    setLoadingStudentDetail(true);
    getStudentAttendanceHistory(selectedStudentDetail.id, start, end)
      .then(setStudentAttendanceHistory)
      .catch((err) => {
        console.error('Lỗi tải lịch sử điểm danh học sinh:', err);
        setStudentAttendanceHistory([]);
      })
      .finally(() => setLoadingStudentDetail(false));
  }, [selectedStudentDetail, selectedTerm]);

  // Get active grade sort type
  const [reportSortType, setReportSortType] = useState<'default' | 'alphabet' | 'code'>(() => {
    try {
      const saved = localStorage.getItem('qllh_grade_sort_type');
      if (saved === 'default' || saved === 'alphabet' || saved === 'code') return saved;
    } catch {}
    return 'default';
  });

  useEffect(() => {
    const handleSortSync = (e: any) => {
      if (e?.detail) setReportSortType(e.detail);
      else {
        const saved = localStorage.getItem('qllh_grade_sort_type');
        if (saved === 'default' || saved === 'alphabet' || saved === 'code') setReportSortType(saved);
      }
    };
    window.addEventListener('qllh_grade_sort_changed', handleSortSync);
    window.addEventListener('storage', handleSortSync);
    return () => {
      window.removeEventListener('qllh_grade_sort_changed', handleSortSync);
      window.removeEventListener('storage', handleSortSync);
    };
  }, []);

  // Students matching the selected class filter
  const filteredStudents = useMemo(() => {
    let result = studentsList;

    if (selectedClassId !== 'all') {
      result = result.filter((s) => s.classId === selectedClassId);
    } else {
      // If 'all', limit to classes of the current year
      const yearClassIds = new Set(yearClasses.map((c) => c.id));
      result = result.filter((s) => yearClassIds.has(s.classId));
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q)
      );
    }

    // Sort: maintain class order if 'all', then apply grade tab sorting rule
    return [...result].sort((a, b) => {
      if (selectedClassId === 'all') {
        const classA = classesList.find((c) => c.id === a.classId)?.name || '';
        const classB = classesList.find((c) => c.id === b.classId)?.name || '';
        const cmpClass = classA.localeCompare(classB, 'vi', { numeric: true });
        if (cmpClass !== 0) return cmpClass;
      }
      if (reportSortType === 'alphabet') {
        const nameA = a.name.trim().split(' ').pop() || '';
        const nameB = b.name.trim().split(' ').pop() || '';
        const cmp = nameA.localeCompare(nameB, 'vi');
        if (cmp !== 0) return cmp;
        return a.name.localeCompare(b.name, 'vi');
      }
      if (reportSortType === 'code') {
        return a.code.localeCompare(b.code, 'vi', { numeric: true });
      }
      // 'default' (Chuẩn)
      if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
        return a.orderIndex - b.orderIndex;
      }
      return 0;
    });
  }, [studentsList, selectedClassId, yearClasses, searchQuery, classesList, reportSortType]);

  // Quick statistics
  const stats = useMemo(() => {
    let goodCount = 0; // Rank T
    let passCount = 0; // Rank H
    let unrankedCount = 0;

    for (const st of filteredStudents) {
      const key = `${st.id}_${selectedTerm}`;
      const keyCode = st.code ? `${st.code}_${selectedTerm}` : '';
      const rec = gradeData[key] || (keyCode ? gradeData[keyCode] : null);
      if (rec && rec.rank === 'T') {
        goodCount++;
      } else if (rec && rec.rank === 'H') {
        passCount++;
      } else {
        unrankedCount++;
      }
    }

    return {
      total: filteredStudents.length,
      good: goodCount,
      pass: passCount,
      unranked: unrankedCount,
    };
  }, [filteredStudents, gradeData, selectedTerm]);

  // Tổng hợp điểm danh của các học sinh đang hiển thị (theo đúng khoảng tuần HK1/Cả năm)
  const attendanceStats = useMemo(() => {
    let present = 0;
    let excused = 0;
    let unexcused = 0;

    for (const st of filteredStudents) {
      const att = attendanceSummary[st.id];
      if (att) {
        present += att.present;
        excused += att.excused;
        unexcused += att.unexcused;
      }
    }

    return { present, excused, unexcused, absent: excused + unexcused };
  }, [filteredStudents, attendanceSummary]);

  // Dữ liệu cho 2 biểu đồ (phân loại T/H/C/chưa có điểm, và phổ điểm + chuyên cần), cùng số
  // liệu cảnh báo cho WarningBanner — tính từ đúng tập học sinh + khoảng tuần đang hiển thị.
  const chartsData = useMemo(() => {
    const classificationCounts = { T: 0, H: 0, C: 0, none: 0 };
    const scoreBuckets = { '9-10': 0, '7-8': 0, '5-6': 0, 'duoi-5': 0 };
    let needsAttentionCount = 0;

    for (const st of filteredStudents) {
      const key = `${st.id}_${selectedTerm}`;
      const keyCode = st.code ? `${st.code}_${selectedTerm}` : '';
      const rec = gradeData[key] || (keyCode ? gradeData[keyCode] : null);
      const rank = (rec?.rank || '').trim().toUpperCase();

      if (rank === 'T') classificationCounts.T++;
      else if (rank === 'H') classificationCounts.H++;
      else if (rank === 'C') classificationCounts.C++;
      else classificationCounts.none++;

      const total = rec?.total !== undefined && rec.total !== '' ? Number(rec.total) : NaN;
      if (!isNaN(total)) {
        if (total >= 9) scoreBuckets['9-10']++;
        else if (total >= 7) scoreBuckets['7-8']++;
        else if (total >= 5) scoreBuckets['5-6']++;
        else scoreBuckets['duoi-5']++;
      }

      const unexcused = attendanceSummary[st.id]?.unexcused || 0;
      if (unexcused > 2) needsAttentionCount++;
    }

    return {
      classificationCounts,
      scoreBuckets,
      absenceBuckets: { '>2': needsAttentionCount },
      missingScoreCount: classificationCounts.none,
      needsAttentionCount,
    };
  }, [filteredStudents, gradeData, selectedTerm, attendanceSummary]);

  // Gán nhận xét T/H tự động cho từng học sinh (dùng chung logic rotation với "Xuất đánh giá
  // Excel" của StudentCommentsManager, để 2 nơi luôn cho ra kết quả nhận xét khớp nhau).
  const assignedComments = useMemo(() => {
    const result: Record<string, { rank: 'T' | 'H'; comment: string }> = {};
    const classesToProcess =
      selectedClassId === 'all'
        ? (yearClasses.length > 0 ? yearClasses : classesList)
        : currentSelectedClass
        ? [currentSelectedClass]
        : [];

    for (const cls of classesToProcess) {
      const rawClassStudents = studentsList.filter((s) => s.classId === cls.id);
      const classStudents = sortStudentsLikeGradeTab(rawClassStudents, reportSortType);
      const grade = resolveClassGrade(cls.grade, cls.name);
      const commentsT = pickCommentBank(grade, 'T', { T: commentBankT, H: commentBankH });
      const commentsH = pickCommentBank(grade, 'H', { T: commentBankT, H: commentBankH });

      let countT = 0;
      let countH = 0;

      for (const st of classStudents) {
        const key = `${st.id}_${selectedTerm}`;
        const keyCode = st.code ? `${st.code}_${selectedTerm}` : '';
        const rec = gradeData[key] || (keyCode ? gradeData[keyCode] : null) || { lt: '', th: '', total: '', rank: '' };
        const rank = resolveClassification(rec.rank, rec.total);

        let comment = '';
        if (rank === 'T') {
          comment = commentsT[countT % commentsT.length];
          countT++;
        } else {
          comment = commentsH[countH % commentsH.length];
          countH++;
        }

        result[st.id] = { rank, comment };
      }
    }

    return result;
  }, [
    selectedClassId,
    yearClasses,
    classesList,
    currentSelectedClass,
    studentsList,
    reportSortType,
    gradeData,
    selectedTerm,
    commentBankT,
    commentBankH,
  ]);

  // Helper to sanitize Excel sheet names (max 31 chars, no invalid chars /\?*[]:)
  const sanitizeSheetName = (name: string, existing: Set<string>): string => {
    let clean = name.replace(/[\/\\?*\[\]:]/g, '-').trim();
    if (!clean) clean = 'Lop';
    if (clean.length > 28) clean = clean.substring(0, 28);

    let finalName = clean;
    let counter = 1;
    while (existing.has(finalName.toLowerCase())) {
      finalName = `${clean.substring(0, 24)} (${counter})`;
      counter++;
    }
    existing.add(finalName.toLowerCase());
    return finalName;
  };

  // Export to Excel function: each class is a separate sheet when 'all' is selected
  const handleExportExcel = () => {
    if (filteredStudents.length === 0) {
      alert('Không có dữ liệu học sinh nào để xuất báo cáo!');
      return;
    }

    const workbook = XLSX.utils.book_new();
    const usedSheetNames = new Set<string>();

    const cols = [
      { wch: 8 },  // STT
      { wch: 16 }, // Mã HS
      { wch: 26 }, // Họ và tên
      { wch: 16 }, // Điểm Lý Thuyết
      { wch: 16 }, // Điểm Thực Hành
      { wch: 12 }, // Tổng Điểm
      { wch: 12 }, // Xếp Loại
    ];

    if (selectedClassId === 'all') {
      // Khi chọn Tất cả các lớp: Mỗi lớp xuất ra 1 sheet riêng biệt
      const classesToExport = yearClasses.length > 0 ? yearClasses : classesList;

      for (const cls of classesToExport) {
        const rawClassStudents = studentsList.filter((s) => s.classId === cls.id);
        const classStudents = sortStudentsLikeGradeTab(rawClassStudents, reportSortType);

        const sheetRows = classStudents.map((st, idx) => {
          const key = `${st.id}_${selectedTerm}`;
          const keyCode = st.code ? `${st.code}_${selectedTerm}` : '';
          const rec = gradeData[key] || (keyCode ? gradeData[keyCode] : null) || { lt: '', th: '', total: '', rank: '' };
          return {
            STT: idx + 1,
            'Mã HS': st.code,
            'Họ và tên': st.name,
            'Điểm Lý Thuyết': rec.lt !== undefined && rec.lt !== '' ? Number(rec.lt) : '',
            'Điểm Thực Hành': rec.th !== undefined && rec.th !== '' ? Number(rec.th) : '',
            'Tổng Điểm': rec.total !== undefined && rec.total !== '' ? Number(rec.total) : '',
            'Xếp Loại': rec.rank || '',
          };
        });

        const worksheet = XLSX.utils.json_to_sheet(
          sheetRows.length > 0
            ? sheetRows
            : [
                {
                  STT: '',
                  'Mã HS': '',
                  'Họ và tên': '(Lớp chưa có học sinh)',
                  'Điểm Lý Thuyết': '',
                  'Điểm Thực Hành': '',
                  'Tổng Điểm': '',
                  'Xếp Loại': '',
                },
              ]
        );

        worksheet['!cols'] = cols;
        const sheetTitle = sanitizeSheetName(cls.name, usedSheetNames);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle);
      }
    } else {
      // Khi chọn 1 lớp cụ thể
      const targetClass = currentSelectedClass;
      const rawClassStudents = studentsList.filter((s) => s.classId === selectedClassId);
      const classStudents = sortStudentsLikeGradeTab(rawClassStudents, reportSortType);

      const sheetRows = classStudents.map((st, idx) => {
        const key = `${st.id}_${selectedTerm}`;
        const keyCode = st.code ? `${st.code}_${selectedTerm}` : '';
        const rec = gradeData[key] || (keyCode ? gradeData[keyCode] : null) || { lt: '', th: '', total: '', rank: '' };
        return {
          STT: idx + 1,
          'Mã HS': st.code,
          'Họ và tên': st.name,
          'Điểm Lý Thuyết': rec.lt !== undefined && rec.lt !== '' ? Number(rec.lt) : '',
          'Điểm Thực Hành': rec.th !== undefined && rec.th !== '' ? Number(rec.th) : '',
          'Tổng Điểm': rec.total !== undefined && rec.total !== '' ? Number(rec.total) : '',
          'Xếp Loại': rec.rank || '',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(sheetRows);
      worksheet['!cols'] = cols;
      const sheetTitle = sanitizeSheetName(targetClass?.name || 'Lop', usedSheetNames);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle);
    }

    const safeClassName = currentSelectedClass
      ? currentSelectedClass.name.replace(/[^a-zA-Z0-9]/g, '_')
      : 'Tat_Ca_Cac_Lop';
    const termSlug = selectedTerm === 'hk1' ? 'Hoc_Ky_1' : 'Ca_Nam';
    const fileName = `Bao_Cao_Diem_${safeClassName}_${termSlug}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  // Xuất báo cáo tổng hợp: Điểm + Nhận xét + Điểm danh, mỗi lớp 1 sheet, mỗi học sinh 1 dòng.
  const [isExportingCombined, setIsExportingCombined] = useState(false);
  const [showExportWeekModal, setShowExportWeekModal] = useState(false);
  const [exportWeekStart, setExportWeekStart] = useState(1);
  const [exportWeekEnd, setExportWeekEnd] = useState(TOTAL_WEEKS);

  const handleOpenExportWeekModal = () => {
    if (filteredStudents.length === 0) {
      alert('Không có dữ liệu học sinh nào để xuất báo cáo!');
      return;
    }
    // Gợi ý sẵn khoảng tuần theo Học kỳ 1 / Cả năm đang chọn, người dùng có thể chỉnh lại trước khi xuất.
    const { start, end } = getWeekRangeForTerm(selectedTerm);
    setExportWeekStart(start);
    setExportWeekEnd(end);
    setShowExportWeekModal(true);
  };

  const handleExportCombinedReport = async (start: number, end: number) => {
    if (filteredStudents.length === 0) {
      alert('Không có dữ liệu học sinh nào để xuất báo cáo!');
      return;
    }
    if (start < 1 || end < start) {
      alert('Khoảng tuần không hợp lệ! Tuần bắt đầu phải từ 1 trở lên và không lớn hơn tuần kết thúc.');
      return;
    }

    setShowExportWeekModal(false);
    setIsExportingCombined(true);
    try {
      const classesToExport =
        selectedClassId === 'all'
          ? (yearClasses.length > 0 ? yearClasses : classesList)
          : currentSelectedClass
          ? [currentSelectedClass]
          : [];

      if (classesToExport.length === 0) {
        alert('Không tìm thấy lớp nào để xuất báo cáo!');
        return;
      }

      let attendance: Record<string, StudentAttendanceSummary> = {};
      try {
        attendance = await getAttendanceSummaryForClasses(
          classesToExport.map((c) => c.id),
          start,
          end
        );
      } catch (err: any) {
        console.error('Lỗi tải điểm danh khi xuất báo cáo tổng hợp:', err);
        alert(`Không thể tải dữ liệu điểm danh: ${err?.message || err}. Báo cáo vẫn được xuất, phần điểm danh sẽ để trống.`);
      }

      const workbook = XLSX.utils.book_new();
      const usedSheetNames = new Set<string>();

      const combinedCols = [
        { wch: 8 },  // STT
        { wch: 16 }, // Mã HS
        { wch: 26 }, // Họ và tên
        { wch: 16 }, // Điểm Lý Thuyết
        { wch: 16 }, // Điểm Thực Hành
        { wch: 12 }, // Tổng Điểm
        { wch: 12 }, // Xếp Loại
        { wch: 55 }, // Nhận xét
        { wch: 15 }, // Số buổi có mặt
        { wch: 18 }, // Số buổi vắng có phép
        { wch: 18 }, // Số buổi vắng không phép
      ];

      for (const cls of classesToExport) {
        const rawClassStudents = studentsList.filter((s) => s.classId === cls.id);
        const classStudents = sortStudentsLikeGradeTab(rawClassStudents, reportSortType);

        const sheetRows = classStudents.map((st, idx) => {
          const key = `${st.id}_${selectedTerm}`;
          const keyCode = st.code ? `${st.code}_${selectedTerm}` : '';
          const rec = gradeData[key] || (keyCode ? gradeData[keyCode] : null) || { lt: '', th: '', total: '', rank: '' };
          const assigned = assignedComments[st.id];
          const att = attendance[st.id] || { present: 0, excused: 0, unexcused: 0 };

          return {
            STT: idx + 1,
            'Mã HS': st.code,
            'Họ và tên': st.name,
            'Điểm Lý Thuyết': rec.lt !== undefined && rec.lt !== '' ? Number(rec.lt) : '',
            'Điểm Thực Hành': rec.th !== undefined && rec.th !== '' ? Number(rec.th) : '',
            'Tổng Điểm': rec.total !== undefined && rec.total !== '' ? Number(rec.total) : '',
            'Xếp Loại': rec.rank || assigned?.rank || '',
            'Nhận xét': assigned?.comment || '',
            'Số buổi có mặt': att.present,
            'Số buổi vắng có phép': att.excused,
            'Số buổi vắng không phép': att.unexcused,
          };
        });

        const worksheet = XLSX.utils.json_to_sheet(
          sheetRows.length > 0
            ? sheetRows
            : [
                {
                  STT: '',
                  'Mã HS': '',
                  'Họ và tên': '(Lớp chưa có học sinh)',
                  'Điểm Lý Thuyết': '',
                  'Điểm Thực Hành': '',
                  'Tổng Điểm': '',
                  'Xếp Loại': '',
                  'Nhận xét': '',
                  'Số buổi có mặt': '',
                  'Số buổi vắng có phép': '',
                  'Số buổi vắng không phép': '',
                },
              ]
        );

        worksheet['!cols'] = combinedCols;
        const sheetTitle = sanitizeSheetName(cls.name, usedSheetNames);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle);
      }

      const safeClassName = currentSelectedClass
        ? currentSelectedClass.name.replace(/[^a-zA-Z0-9]/g, '_')
        : 'Tat_Ca_Cac_Lop';
      const termSlug = selectedTerm === 'hk1' ? 'Hoc_Ky_1' : 'Ca_Nam';
      const fileName = `Bao_Cao_Tong_Hop_${safeClassName}_${termSlug}.xlsx`;

      XLSX.writeFile(workbook, fileName);
    } finally {
      setIsExportingCombined(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-xl bg-blue-50 text-[#0070F3]">
                <BarChart3 className="w-5 h-5" />
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Báo cáo kết quả học tập
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Báo cáo điểm số, xếp loại và xuất bảng điểm Excel chuẩn (tất cả các lớp)
            </p>
          </div>

          {/* Actions: Combined export (primary) + legacy exports (secondary) */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowCommentsModal(true)}
              className="bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-xs shadow-2xs whitespace-nowrap cursor-pointer active:scale-95"
              title="Xuất đánh giá và nhận xét học sinh tự động ra Excel (theo khối hoặc tất cả các lớp)"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Xuất đánh giá Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="bg-white hover:bg-slate-50 text-[#0070f3] border border-blue-200 px-3.5 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-xs shadow-2xs whitespace-nowrap cursor-pointer active:scale-95"
              title="Xuất bảng điểm ra file Excel (chỉ điểm số)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Excel</span>
            </button>

            <button
              type="button"
              onClick={handleOpenExportWeekModal}
              disabled={isExportingCombined}
              className="bg-[#0070f3] hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 text-sm shadow-md whitespace-nowrap cursor-pointer active:scale-95"
              title="Xuất 1 file Excel tổng hợp: điểm số + nhận xét + điểm danh, mỗi lớp 1 sheet"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExportingCombined ? 'Đang xuất...' : 'Xuất báo cáo tổng hợp'}</span>
            </button>
          </div>
        </div>

        {/* Filters Controls Toolbar */}
        <div className="flex flex-col md:flex-row flex-wrap items-stretch md:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            {/* Class Selector Dropdown */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 shadow-2xs">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-700">Lớp:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="text-xs font-bold text-[#0070f3] outline-none bg-transparent cursor-pointer pr-2"
              >
                <option value="all">Tất cả các lớp ({yearClasses.length} lớp)</option>
                {yearClasses.map((cls) => {
                  const studentCount = studentsList.filter((s) => s.classId === cls.id).length;
                  return (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({studentCount} HS)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Term Switcher: Học kỳ 1 vs Cả năm */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedTerm('hk1')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedTerm === 'hk1'
                    ? 'bg-white text-[#0070f3] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Học kỳ 1
              </button>
              <button
                type="button"
                onClick={() => setSelectedTerm('hk2')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedTerm === 'hk2'
                    ? 'bg-white text-[#0070f3] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cả năm
              </button>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              placeholder="Tìm theo tên hoặc mã HS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-[#0070f3] focus:ring-2 focus:ring-blue-100 text-slate-800"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0070f3] flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Tổng học sinh</p>
            <p className="text-xl font-black text-slate-900">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Hoàn thành Tốt (T)</p>
            <p className="text-xl font-black text-emerald-600">{stats.good}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Hoàn thành (H)</p>
            <p className="text-xl font-black text-indigo-600">{stats.pass}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center font-bold">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Chưa có điểm</p>
            <p className="text-xl font-black text-slate-600">{stats.unranked}</p>
          </div>
        </div>
      </div>

      {/* Attendance & Remarks Coverage Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">
              Có mặt ({selectedTerm === 'hk1' ? 'HK1' : 'Cả năm'})
            </p>
            <p className="text-xl font-black text-emerald-600">{attendanceStats.present}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">
              Vắng ({selectedTerm === 'hk1' ? 'HK1' : 'Cả năm'})
            </p>
            <p className="text-xl font-black text-amber-600">{attendanceStats.absent}</p>
            <p className="text-[10px] font-semibold text-slate-400">
              {attendanceStats.excused} có phép · {attendanceStats.unexcused} không phép
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
            <MessageSquareText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Đã có nhận xét</p>
            <p className="text-xl font-black text-indigo-600">
              {stats.good + stats.pass} / {stats.total}
            </p>
            <p className="text-[10px] font-semibold text-slate-400">
              {stats.unranked} học sinh chưa xếp loại nên dùng nhận xét mặc định
            </p>
          </div>
        </div>
      </div>

      <WarningBanner
        missingScoreCount={chartsData.missingScoreCount}
        needsAttentionCount={chartsData.needsAttentionCount}
      />

      {/* Charts Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Award className="w-4 h-4 text-[#0070f3]" />
            <span>Tỉ lệ xếp loại</span>
          </h3>
          <p className="text-[11px] text-slate-500 font-semibold mb-2">
            Phân bổ Hoàn thành Tốt / Hoàn thành / Chưa hoàn thành / Chưa có điểm
          </p>
          <ClassificationPieChart data={chartsData.classificationCounts} />
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#0070f3]" />
            <span>Phổ điểm & chuyên cần</span>
          </h3>
          <p className="text-[11px] text-slate-500 font-semibold mb-2">
            Số học sinh theo mức điểm, và số em vắng không phép trên 2 buổi
          </p>
          <ScoreAttendanceBarChart
            scoreBuckets={chartsData.scoreBuckets}
            absenceBuckets={chartsData.absenceBuckets}
          />
        </div>
      </div>

      {/* Main Report Table (Matching Excel columns in image 27a0ed05.png) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#0070f3]" />
            <span>
              Bảng điểm {selectedTerm === 'hk1' ? 'Học kỳ 1' : 'Cả năm'} ·{' '}
              {currentSelectedClass ? `Lớp ${currentSelectedClass.name}` : 'Tất cả các lớp'}
            </span>
          </h3>
          <span className="text-xs font-bold text-slate-500">
            {filteredStudents.length} học sinh
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 text-[11px] uppercase tracking-wider font-bold">
                <th className="p-3 w-14 text-center">STT</th>
                <th className="p-3 w-32">MÃ HS</th>
                <th className="p-3">HỌ VÀ TÊN</th>
                {selectedClassId === 'all' && <th className="p-3 w-28">LỚP</th>}
                <th className="p-3 text-center w-32">ĐIỂM LÝ THUYẾT</th>
                <th className="p-3 text-center w-32">ĐIỂM THỰC HÀNH</th>
                <th className="p-3 text-center w-28">TỔNG ĐIỂM</th>
                <th className="p-3 text-center w-24">XẾP LOẠI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={selectedClassId === 'all' ? 8 : 7}
                    className="text-center p-12 text-slate-400 font-semibold text-sm"
                  >
                    Chưa có dữ liệu học sinh phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, index) => {
                  const key = `${st.id}_${selectedTerm}`;
                  const keyCode = st.code ? `${st.code}_${selectedTerm}` : '';
                  const rec = gradeData[key] || (keyCode ? gradeData[keyCode] : null) || { lt: '', th: '', total: '', rank: '' };
                  const className = classesList.find((c) => c.id === st.classId)?.name || '-';

                  return (
                    <tr key={st.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="p-3 text-center font-mono text-slate-400 font-bold">
                        {index + 1}
                      </td>
                      <td className="p-3 font-mono text-slate-700 font-bold">
                        {st.code}
                      </td>
                      <td className="p-3 font-bold text-blue-900">
                        <button
                          type="button"
                          onClick={() => setSelectedStudentDetail(st)}
                          className="hover:underline hover:text-blue-700 cursor-pointer text-left"
                          title="Xem chi tiết điểm, điểm danh và nhận xét của học sinh"
                        >
                          {st.name}
                        </button>
                      </td>
                      {selectedClassId === 'all' && (
                        <td className="p-3 font-bold text-slate-600">
                          {className}
                        </td>
                      )}
                      <td className="p-3 text-center font-semibold text-slate-800">
                        {rec.lt !== undefined && rec.lt !== '' ? rec.lt : '-'}
                      </td>
                      <td className="p-3 text-center font-semibold text-slate-800">
                        {rec.th !== undefined && rec.th !== '' ? rec.th : '-'}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`font-black text-sm ${
                            rec.total
                              ? Number(rec.total) >= 9
                                ? 'text-emerald-600'
                                : 'text-blue-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {rec.total !== undefined && rec.total !== '' ? rec.total : '-'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {rec.rank ? (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-black ${rankBadgeClass(rec.rank)}`}
                          >
                            {rec.rank}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evaluation & Comments Modal */}
      {showCommentsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative animate-fadeIn">
            <StudentCommentsManager
              isModal={true}
              onCloseModal={() => setShowCommentsModal(false)}
              currentUser={currentUser}
            />
          </div>
        </div>
      )}

      {/* Student Detail Drill-down Modal (read-only): grades + attendance history + remark */}
      {selectedStudentDetail && (() => {
        const st = selectedStudentDetail;
        const key = `${st.id}_${selectedTerm}`;
        const keyCode = st.code ? `${st.code}_${selectedTerm}` : '';
        const rec = gradeData[key] || (keyCode ? gradeData[keyCode] : null) || { lt: '', th: '', total: '', rank: '' };
        const assigned = assignedComments[st.id];
        const detailClassName = classesList.find((c) => c.id === st.classId)?.name || '-';

        const presentWeeks = studentAttendanceHistory.filter((w) => w.status === 'present');
        const excusedWeeks = studentAttendanceHistory.filter((w) => w.status === 'excused');
        const unexcusedWeeks = studentAttendanceHistory.filter((w) => w.status === 'unexcused');

        return (
          <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setSelectedStudentDetail(null)}
          >
            <div
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative animate-fadeIn"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSelectedStudentDetail(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="pr-10 mb-5">
                <h3 className="text-xl font-black text-slate-900">{st.name}</h3>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  Mã HS: {st.code} · Lớp {detailClassName} · {selectedTerm === 'hk1' ? 'Học kỳ 1' : 'Cả năm'}
                </p>
              </div>

              {/* Điểm số */}
              <div className="mb-5">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide mb-2">Điểm số</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500">Lý thuyết</p>
                    <p className="text-lg font-black text-slate-800">{rec.lt !== '' ? rec.lt : '-'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500">Thực hành</p>
                    <p className="text-lg font-black text-slate-800">{rec.th !== '' ? rec.th : '-'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500">Tổng điểm</p>
                    <p className="text-lg font-black text-blue-600">{rec.total !== '' ? rec.total : '-'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500">Xếp loại</p>
                    <p className={`text-lg font-black ${rankTextClass(rec.rank || assigned?.rank)}`}>{rec.rank || assigned?.rank || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Điểm danh */}
              <div className="mb-5">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide mb-2">
                  Lịch sử điểm danh ({selectedTerm === 'hk1' ? 'Học kỳ 1' : 'Cả năm'})
                </h4>
                {loadingStudentDetail ? (
                  <p className="text-xs text-slate-400 font-semibold">Đang tải...</p>
                ) : studentAttendanceHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 font-semibold">Chưa có dữ liệu điểm danh.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-emerald-700">
                      Có mặt ({presentWeeks.length}):{' '}
                      {presentWeeks.length > 0 ? presentWeeks.map((w) => w.weekNumber).join(', ') : '—'}
                    </p>
                    <p className="text-xs font-semibold text-amber-700">
                      Vắng có phép ({excusedWeeks.length}):{' '}
                      {excusedWeeks.length > 0 ? excusedWeeks.map((w) => w.weekNumber).join(', ') : '—'}
                    </p>
                    <p className="text-xs font-semibold text-rose-700">
                      Vắng không phép ({unexcusedWeeks.length}):{' '}
                      {unexcusedWeeks.length > 0 ? unexcusedWeeks.map((w) => w.weekNumber).join(', ') : '—'}
                    </p>
                  </div>
                )}
              </div>

              {/* Nhận xét */}
              <div>
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide mb-2">Nhận xét</h4>
                <p className="text-sm text-slate-700 bg-indigo-50 border border-indigo-100 rounded-xl p-3 font-medium">
                  {assigned?.comment || 'Chưa có nhận xét cho học sinh này.'}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Popup chọn khoảng tuần điểm danh trước khi xuất báo cáo tổng hợp */}
      {showExportWeekModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#0070f3]" />
              Chọn khoảng tuần điểm danh để xuất
            </h3>
            <p className="text-xs text-slate-500">
              Điểm số và nhận xét luôn tính theo {selectedTerm === 'hk1' ? 'Học kỳ 1' : 'Cả năm'} đang chọn. Phần điểm danh sẽ được tổng hợp đúng theo khoảng tuần bạn chọn dưới đây.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Từ tuần</label>
                <input
                  type="number"
                  min={1}
                  max={TOTAL_WEEKS}
                  value={exportWeekStart}
                  onChange={(e) => setExportWeekStart(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Đến tuần</label>
                <input
                  type="number"
                  min={1}
                  max={TOTAL_WEEKS}
                  value={exportWeekEnd}
                  onChange={(e) => setExportWeekEnd(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExportWeekModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleExportCombinedReport(exportWeekStart, exportWeekEnd)}
                className="px-4 py-1.5 text-xs font-semibold bg-[#0070f3] text-white rounded-lg hover:bg-blue-700"
              >
                Xuất báo cáo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
