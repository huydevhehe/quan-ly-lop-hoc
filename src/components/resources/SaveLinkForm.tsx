import React, { useState } from 'react';
import { Link2, AlertCircle, Check, Loader2 } from 'lucide-react';
import { createResource } from '../../services/resourcesService';

interface SaveLinkFormProps {
  type: 'video' | 'link';
  grade?: number;
  onSaved?: () => void;
  onCancel?: () => void;
}

export const SaveLinkForm: React.FC<SaveLinkFormProps> = ({
  type,
  grade = 1,
  onSaved,
  onCancel,
}) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<number>(grade);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề cho liên kết');
      return;
    }

    if (!url.trim()) {
      setErrorMsg('Vui lòng nhập đường dẫn URL');
      return;
    }

    setIsSaving(true);
    try {
      await createResource({
        type,
        title: title.trim(),
        url: url.trim(),
        grade: selectedGrade,
        isActive: true,
      });

      setTitle('');
      setUrl('');
      if (onSaved) onSaved();
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể lưu liên kết. Vui lòng kiểm tra lại URL.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-slate-800 font-bold text-xs pb-1">
        <Link2 className="w-4 h-4 text-emerald-600" />
        <span>Lưu liên kết trang web {type === 'video' ? 'bài giảng' : 'tiện ích / tài liệu'}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            Tiêu đề liên kết
          </label>
          <input
            type="text"
            placeholder="Ví dụ: Trang luyện gõ 10 ngón TypingClub"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-emerald-500"
            required
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Khối lớp</label>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-emerald-500"
          >
            {[1, 2, 3, 4, 5].map((g) => (
              <option key={g} value={g}>
                Khối {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-600 mb-1">
          Địa chỉ web (URL)
        </label>
        <input
          type="url"
          placeholder="https://example.com/bai-hoc"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (errorMsg) setErrorMsg('');
          }}
          className={`w-full px-3 py-2 rounded-xl bg-white border text-xs font-medium focus:outline-emerald-500 ${
            errorMsg ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
          }`}
          required
        />
        {errorMsg && (
          <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1 font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors"
          >
            Hủy
          </button>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          <span>{isSaving ? 'Đang lưu...' : 'Lưu liên kết'}</span>
        </button>
      </div>
    </form>
  );
};
