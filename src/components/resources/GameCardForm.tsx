import React, { useState } from 'react';
import { Gamepad2, Image as ImageIcon, AlertTriangle, AlertCircle, Check, Loader2, Upload } from 'lucide-react';
import { createResource, updateResource } from '../../services/resourcesService';
import { uploadQuestionImage } from '../../services/quizImageService';
import { Resource } from '../../types';

interface GameCardFormProps {
  onSaved?: () => void;
  onCancel?: () => void;
  editing?: Resource | null;
}

export const GameCardForm: React.FC<GameCardFormProps> = ({ onSaved, onCancel, editing = null }) => {
  const [title, setTitle] = useState(editing?.title || '');
  const [url, setUrl] = useState(editing?.url || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(editing?.thumbnailUrl || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(editing?.thumbnailUrl || null);
  const [aspectWarning, setAspectWarning] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!editing;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);

    // Kiểm tra tỉ lệ ảnh (khuyên dùng 16:9 ~ 1.77)
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      if (ratio < 1.6 || ratio > 1.9) {
        setAspectWarning(
          `Ảnh có tỉ lệ ${ratio.toFixed(2)}:1. Khuyên dùng tỉ lệ chuẩn 16:9 (~1.78:1) để card game hiển thị đẹp nhất.`
        );
      } else {
        setAspectWarning(null);
      }
    };
    img.src = objectUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tên trò chơi');
      return;
    }

    if (!url.trim()) {
      setErrorMsg('Vui lòng nhập đường dẫn liên kết trò chơi');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalThumb = thumbnailUrl.trim();

      // Nếu có chọn file ảnh, upload lên storage
      if (selectedFile) {
        const uploadRes = await uploadQuestionImage(selectedFile);
        if ('error' in uploadRes) {
          setErrorMsg(uploadRes.error);
          setIsSubmitting(false);
          return;
        }
        finalThumb = uploadRes.url;
      }

      if (!finalThumb) {
        finalThumb = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80';
      }

      if (isEditing && editing) {
        await updateResource(editing.id, {
          title: title.trim(),
          url: url.trim(),
          thumbnailUrl: finalThumb,
        });
      } else {
        // Lưu vào Supabase resources với type: 'game', mặc định isActive: false
        await createResource({
          type: 'game',
          title: title.trim(),
          url: url.trim(),
          thumbnailUrl: finalThumb,
          isActive: false,
        });
      }

      if (onSaved) onSaved();
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể lưu trò chơi. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4">
      <div className="flex items-center gap-2.5 text-slate-800 font-bold text-sm pb-2 border-b border-slate-200/60">
        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
          <Gamepad2 className="w-4 h-4" />
        </div>
        <div>
          <h4 className="font-bold text-slate-900 text-xs">
            {isEditing ? 'Sửa trò chơi giáo dục' : 'Thêm trò chơi giáo dục mới'}
          </h4>
          <p className="text-[11px] text-slate-500 font-normal">
            {isEditing
              ? 'Cập nhật tên, liên kết hoặc ảnh nền của thẻ game này'
              : 'Thẻ game sau khi thêm sẽ ở trạng thái chờ, bạn có thể bấm kích hoạt để học sinh chơi'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Tên trò chơi</label>
          <input
            type="text"
            placeholder="Ví dụ: Nhanh như chớp nhí Toán học"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-emerald-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Đường dẫn trò chơi (URL)</label>
          <input
            type="url"
            placeholder="https://wordwall.net/play/..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-emerald-500"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          Ảnh nền trò chơi (Khuyên dùng chuẩn 16:9)
        </label>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="px-4 py-2 bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-2xs">
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
            placeholder="Nhập trực tiếp link ảnh nền https://..."
            value={thumbnailUrl}
            onChange={(e) => {
              setThumbnailUrl(e.target.value);
              setImagePreview(e.target.value);
            }}
            className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-emerald-500"
          />
        </div>

        {/* Warning tỉ lệ */}
        {aspectWarning && (
          <p className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-xl mt-2 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{aspectWarning}</span>
          </p>
        )}

        {/* Image Preview */}
        {imagePreview && (
          <div className="mt-3 relative aspect-video max-w-xs rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-900">
            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            <span className="absolute bottom-1.5 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold">
              Xem trước 16:9
            </span>
          </div>
        )}
      </div>

      {errorMsg && (
        <p className="flex items-center gap-1 text-xs text-rose-600 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Hủy
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span>{isSubmitting ? 'Đang lưu...' : isEditing ? 'Cập nhật thẻ game' : 'Tạo thẻ game'}</span>
        </button>
      </div>
    </form>
  );
};
