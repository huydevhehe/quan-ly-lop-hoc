import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface WarningBannerProps {
  missingScoreCount: number;
  needsAttentionCount: number;
}

export const WarningBanner: React.FC<WarningBannerProps> = ({
  missingScoreCount,
  needsAttentionCount,
}) => {
  // Mặc định ẩn, chỉ hiện khi có ít nhất 1 học sinh thuộc diện cảnh báo
  if (missingScoreCount === 0 && needsAttentionCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs shadow-2xs animate-in fade-in">
      <div className="p-1.5 bg-amber-100 rounded-lg text-amber-600 shrink-0">
        <AlertTriangle className="w-4 h-4" />
      </div>
      <div className="flex-1 font-medium">
        Phát hiện{' '}
        {missingScoreCount > 0 && (
          <span className="font-bold text-amber-900">{missingScoreCount} học sinh chưa có điểm</span>
        )}
        {missingScoreCount > 0 && needsAttentionCount > 0 && ' và '}
        {needsAttentionCount > 0 && (
          <span className="font-bold text-amber-900">
            {needsAttentionCount} học sinh cần lưu ý về chuyên cần
          </span>
        )}
        . Vui lòng kiểm tra lại danh sách bên dưới.
      </div>
    </div>
  );
};
