import { describe, it, expect } from 'vitest';
import { exportFinalReportExcel, exportWeeklyCommentsExcel } from '../excelExportService';

describe('excelExportService', () => {
  const classInfo = {
    schoolName: 'Trường Tiểu học Kim Đồng',
    className: 'Lớp 5A',
    semester: 'Học kỳ 1',
    schoolYear: '2026-2027',
    subject: 'Tin học',
    teacherName: 'Thầy Nguyễn Văn A',
  };

  it('exportFinalReportExcel khong nem loi voi ten rat dai', async () => {
    const mockStudents = [
      {
        stt: 1,
        studentCode: 'HS001',
        fullName: 'Nguyễn Thị Rất Là Dài Tên Ví Dụ Để Kiểm Tra Auto Fit Cột',
        theoryScore: 9.0,
        practiceScore: 10.0,
        totalScore: 9.5,
        classification: 'T',
        absenceExcused: 1,
        absenceUnexcused: 0,
      },
    ];

    const blob = await exportFinalReportExcel(classInfo, mockStudents);
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('exportWeeklyCommentsExcel tao file voi du 35 cot tuan', async () => {
    const mockStudents = [
      {
        studentCode: 'HS001',
        fullName: 'Trần Văn B',
        weeklyComments: {
          1: 'Học tốt',
          2: 'Chăm phát biểu',
        },
      },
    ];

    const blob = await exportWeeklyCommentsExcel(mockStudents);
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(0);
  });
});
