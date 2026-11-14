import ExcelJS from 'exceljs';

export interface FinalReportClassInfo {
  schoolName: string;
  className: string;
  semester: string;
  schoolYear: string;
  subject: string;
  teacherName: string;
}

export interface FinalReportStudentItem {
  stt: number;
  studentCode: string;
  fullName: string;
  theoryScore: number | null;
  practiceScore: number | null;
  totalScore: number | null;
  classification: string | null;
  absenceExcused: number;
  absenceUnexcused: number;
}

export interface WeeklyCommentsStudentItem {
  studentCode: string;
  fullName: string;
  weeklyComments: Record<number, string>;
}

/**
 * Xuất file Excel Báo cáo Điểm chuẩn in ấn
 */
export async function exportFinalReportExcel(
  classInfo: FinalReportClassInfo,
  students: FinalReportStudentItem[]
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Bảng Điểm');

  // Title rows
  worksheet.addRow([classInfo.schoolName]);
  worksheet.addRow([`BẢNG ĐIỂM VÀ ĐÁNH GIÁ HỌC SINH - ${classInfo.className.toUpperCase()}`]);
  worksheet.addRow([
    `Năm học: ${classInfo.schoolYear} | Học kỳ: ${classInfo.semester} | Môn: ${classInfo.subject} | GV: ${classInfo.teacherName}`,
  ]);
  worksheet.addRow([]); // Blank line

  // Header row
  const header = [
    'STT',
    'Mã Học Sinh',
    'Họ và Tên',
    'Điểm Lý Thuyết',
    'Điểm Thực Hành',
    'Điểm Tổng Kết',
    'Xếp Loại',
    'Vắng Có Phép',
    'Vắng Không Phép',
  ];
  const headerRow = worksheet.addRow(header);

  headerRow.font = { name: 'Times New Roman', size: 12, bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Data rows
  students.forEach((s) => {
    worksheet.addRow([
      s.stt,
      s.studentCode,
      s.fullName,
      s.theoryScore !== null ? s.theoryScore : '',
      s.practiceScore !== null ? s.practiceScore : '',
      s.totalScore !== null ? s.totalScore : '',
      s.classification || '',
      s.absenceExcused,
      s.absenceUnexcused,
    ]);
  });

  // Auto-fit column widths
  worksheet.columns.forEach((column) => {
    let maxLen = 12;
    if (column && column.eachCell) {
      column.eachCell({ includeEmpty: false }, (cell) => {
        const cellValue = cell.value ? String(cell.value) : '';
        if (cellValue.length > maxLen) {
          maxLen = cellValue.length;
        }
      });
    }
    column.width = Math.min(maxLen + 3, 40);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Xuất file Excel Nhận xét 35 tuần của cả lớp
 */
export async function exportWeeklyCommentsExcel(
  students: WeeklyCommentsStudentItem[]
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Nhận Xét 35 Tuần');

  const headers = ['Mã HS', 'Họ và Tên'];
  for (let w = 1; w <= 35; w++) {
    headers.push(`Tuần ${w}`);
  }

  const headerRow = worksheet.addRow(headers);
  headerRow.font = { name: 'Times New Roman', size: 11, bold: true };

  students.forEach((s) => {
    const row = [s.studentCode, s.fullName];
    for (let w = 1; w <= 35; w++) {
      row.push(s.weeklyComments[w] || '');
    }
    worksheet.addRow(row);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
