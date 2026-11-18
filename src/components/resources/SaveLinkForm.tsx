import React, { useState } from 'react';
import { Link2, AlertCircle, Check, Loader2, Upload, Image as ImageIcon } from 'lucide-react';
import { createResource, updateResource } from '../../services/resourcesService';
import { uploadQuestionImage } from '../../services/quizImageService';
import { Resource } from '../../types';

interface SaveLinkFormProps {
  type: 'video' | 'link';
  grade?: number;
  onSaved?: () => void;
  onCancel?: () => void;
  editing?: Resource | null;
  showGrade?: boolean;
}

export const SaveLinkForm: React.FC<SaveLinkFormProps> = ({
  type,
  grade = 1,
  onSaved,
  onCancel,
  editing = null,
  showGrade = type === 'video',
}) => {
  const [title, setTitle] = useState(editing?.title || '');
  const [url, setUrl] = useState(editing?.url || '');
  const [selectedGrade, setSelectedGrade] = useState<number>(editing?.grade || grade);
  const [thumbnailUrl, setThumbnailUrl] = useState(editing?.thumbnailUrl || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(editing?.thumbnailUrl || null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = !!editing;
  const showGradeField = showGrade;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);
  };

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
      let finalThumb = thumbnailUrl.trim();

      // Nếu có chọn file ảnh, upload lên storage
      if (selectedFile) {
        const uploadRes = await uploadQuestionImage(selectedFile);
        if ('error' in uploadRes) {
          setErrorMsg(uploadRes.error);
          setIsSaving(false);
          return;
        }
        finalThumb = uploadRes.url;
      }

      if (isEditing && editing) {
        await updateResource(editing.id, {
          title: title.trim(),
          url: url.trim(),
          grade: showGradeField ? selectedGrade : undefined,
          thumbnailUrl: finalThumb || undefined,
        });
      } else {
        await createResource({
          type,
          title: title.trim(),
          url: url.trim(),
          grade: showGradeField ? selectedGrade : undefined,
          thumbnailUrl: finalThumb || undefined,
          isActive: true,
        });
      }

      setTitle('');
      setUrl('');
      setThumbnailUrl('');
      setSelectedFile(null);
      setImagePreview(null);
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
        <span>
          {isEditing ? 'Sửa liên kết trang web' : 'Lưu liên kết trang web'}{' '}
          {type === 'video' ? 'bài giảng' : 'tiện ích / tài liệu'}
        </span>
      </div>

      <div className={`grid grid-cols-1 gap-3 ${showGradeField ? 'sm:grid-cols-3' : ''}`}>
        <div className={showGradeField ? 'sm:col-span-2' : ''}>
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

        {showGradeField && (
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
        )}
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
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
          <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
          <span>Ảnh thumbnail (không bắt buộc)</span>
        </label>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="px-3 py-2 bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-2xs">
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tải ảnh từ máy tính</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          <span className="text-xs text-slate-400">hoặc</span>
          <input
            type="url"
            placeholder="Nhập trực tiếp link ảnh thumbnail https://..."
            value={thumbnailUrl}
            onChange={(e) => {
              setThumbnailUrl(e.target.value);
              setImagePreview(e.target.value);
            }}
            className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-emerald-500"
          />
        </div>

        {imagePreview && (
          <div className="mt-3 relative aspect-video max-w-xs rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-900">
            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            <span className="absolute bottom-1.5 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold">
              Xem trước
            </span>
          </div>
        )}
      </div>

      {errorMsg && (
        <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </p>
      )}

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
          <span>{isSaving ? 'Đang lưu...' : isEditing ? 'Cập nhật liên kết' : 'Lưu liên kết'}</span>
        </button>
      </div>
    </form>
  );
};
