import React from 'react';
import { User, X, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

interface StudentQuickProfilePopupProps {
  student: {
    id: string;
    code: string;
    name: string;
    avatar?: string;
  };
  scoreInfo?: {
    total?: string;
    rank?: string;
  };
  absenceCount?: number;
  latestComment?: string;
  onViewDetail?: () => void;
  onClose: () => void;
}

export const StudentQuickProfilePopup: React.FC<StudentQuickProfilePopupProps> = ({
  student,
  scoreInfo,
  absenceCount = 0,
  latestComment,
  onViewDetail,
  onClose,
}) => {
  return (
    <div className="absolute z-50 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 text-left animate-in fade-in zoom-in-95">
      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
            {student.avatar ? (
              <img src={student.avatar} alt={student.name} className="w-full h-full object-cover rounded-xl" />
            ) : (
              <User className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm leading-tight">{student.name}</h4>
            <span className="text-xs text-slate-400 font-mono">Mã: {student.code}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="py-3 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Xếp loại & Điểm:</span>
          <span className="font-bold text-slate-800">
            {scoreInfo?.rank ? `${scoreInfo.rank} (${scoreInfo.total || '0'} đ)` : 'Chưa có điểm'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-500">Vắng không phép:</span>
          <span className={`font-bold ${absenceCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {absenceCount > 0 ? `${absenceCount} buổi` : '0 buổi'}
          </span>
        </div>

        {latestComment && (
          <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-slate-600 text-[11px] italic">
            "{latestComment}"
          </div>
        )}
      </div>

      {onViewDetail && (
        <button
          onClick={onViewDetail}
          className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
        >
          <span>Xem chi tiết hồ sơ</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
