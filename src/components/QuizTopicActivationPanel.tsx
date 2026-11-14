import React, { useState, useEffect } from 'react';
import { CheckSquare, Square, Plus, BookOpen, Layers, Check, Loader2 } from 'lucide-react';
import { listTopics, setTopicActive, createTopic, QuizTopicItem } from '../services/quizService';

interface QuizTopicActivationPanelProps {
  grade: number | 'all';
  selectedTopicId?: string | null;
  onSelectTopic?: (topicId: string | null) => void;
}

export const QuizTopicActivationPanel: React.FC<QuizTopicActivationPanelProps> = ({
  grade,
  selectedTopicId = null,
  onSelectTopic,
}) => {
  const [topics, setTopics] = useState<QuizTopicItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicGrade, setNewTopicGrade] = useState<number>(grade === 'all' ? 1 : grade);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const data = await listTopics();
      setTopics(data);
    } catch (err: any) {
      console.error('Lỗi tải danh sách chủ đề:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  useEffect(() => {
    if (grade !== 'all') {
      setNewTopicGrade(grade);
    }
  }, [grade]);

  const displayTopics = grade === 'all' ? topics : topics.filter((t) => t.grade === grade);
  const allActive = displayTopics.length > 0 && displayTopics.every((t) => t.isActive);

  const handleToggleOne = async (e: React.MouseEvent, topic: QuizTopicItem) => {
    e.stopPropagation();
    const nextStatus = !topic.isActive;
    try {
      await setTopicActive(topic.id, nextStatus);
      setTopics((prev) =>
        prev.map((t) => (t.id === topic.id ? { ...t, isActive: nextStatus } : t))
      );
    } catch (err: any) {
      alert(`Không thể đổi trạng thái chủ đề: ${err.message}`);
    }
  };

  const handleToggleAll = async () => {
    const nextStatus = !allActive;
    try {
      await Promise.all(displayTopics.map((t) => setTopicActive(t.id, nextStatus)));
      const updatedIds = new Set(displayTopics.map((t) => t.id));
      setTopics((prev) =>
        prev.map((t) => (updatedIds.has(t.id) ? { ...t, isActive: nextStatus } : t))
      );
    } catch (err: any) {
      alert(`Không thể cập nhật tất cả chủ đề: ${err.message}`);
    }
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;

    setIsSubmitting(true);
    try {
      const newId = await createTopic(newTopicGrade, newTopicName.trim());
      setTopics((prev) => [
        ...prev,
        {
          id: newId,
          grade: newTopicGrade,
          name: newTopicName.trim(),
          isActive: false,
          questionCount: 0,
        },
      ]);
      setNewTopicName('');
      setShowAddModal(false);
    } catch (err: any) {
      alert(`Lỗi tạo chủ đề mới: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Quản lý & Kích hoạt chủ đề thi</h3>
            <p className="text-[11px] text-slate-500">
              Tick chọn chủ đề để cho phép học sinh vào làm bài thi trực tuyến
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {displayTopics.length > 0 && (
            <button
              onClick={handleToggleAll}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                allActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {allActive ? (
                <CheckSquare className="w-4 h-4 text-emerald-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>{allActive ? 'Bỏ kích hoạt tất cả' : 'Kích hoạt tất cả'}</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm chủ đề</span>
          </button>
        </div>
      </div>

      {/* Topics List */}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-slate-400 text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          <span>Đang tải danh sách chủ đề...</span>
        </div>
      ) : displayTopics.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
          Chưa có chủ đề nào cho khối lớp này. Bấm "+ Thêm chủ đề" để bắt đầu.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {displayTopics.map((topic) => {
            const isSelected = selectedTopicId === topic.id;
            return (
              <div
                key={topic.id}
                onClick={() => onSelectTopic && onSelectTopic(isSelected ? null : topic.id)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      K{topic.grade}
                    </span>
                    <h4 className="text-xs font-bold text-slate-800 truncate" title={topic.name}>
                      {topic.name}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {topic.questionCount} câu hỏi
                  </p>
                </div>

                {/* Checkbox toggle status */}
                <button
                  type="button"
                  onClick={(e) => handleToggleOne(e, topic)}
                  className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                    topic.isActive
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  }`}
                  title={topic.isActive ? 'Đang mở cho học sinh thi' : 'Đang đóng'}
                >
                  {topic.isActive ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Add Topic Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-slate-900 text-base mb-1">Thêm chủ đề kiểm tra mới</h3>
            <p className="text-xs text-slate-500 mb-4">
              Tạo chủ đề để nhóm các câu hỏi trắc nghiệm theo bài học
            </p>

            <form onSubmit={handleAddTopic} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Khối lớp</label>
                <select
                  value={newTopicGrade}
                  onChange={(e) => setNewTopicGrade(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-emerald-500"
                >
                  {[1, 2, 3, 4, 5].map((g) => (
                    <option key={g} value={g}>
                      Khối lớp {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên chủ đề</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Ôn tập phép cộng trong phạm vi 100"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-emerald-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Tạo chủ đề'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
