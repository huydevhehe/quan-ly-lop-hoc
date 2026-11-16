import React, { useState, useEffect } from 'react';
import {
  Video,
  Play,
  FileText,
  Eye,
  Clock,
  Plus,
  ExternalLink,
  BookOpen,
  X,
  Share2
} from 'lucide-react';
import { DigitalResource, Resource } from '../types';
import { listResources, createResource, deleteResource } from '../services/resourcesService';
import { SaveLinkForm } from './resources/SaveLinkForm';

interface DigitalResourcesProps {
  isAdmin?: boolean;
}

const PLACEHOLDER_THUMBNAIL =
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80';

// Bảng màu xoay vòng cho thẻ "Liên kết trang web đã lưu" - to, rõ, nhiều màu cho dễ phân biệt
const LINK_CARD_COLORS = [
  { bg: 'bg-emerald-50/70', border: 'border-emerald-200', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700' },
  { bg: 'bg-blue-50/70', border: 'border-blue-200', iconBg: 'bg-blue-100', iconText: 'text-blue-600', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700' },
  { bg: 'bg-amber-50/70', border: 'border-amber-200', iconBg: 'bg-amber-100', iconText: 'text-amber-600', badgeBg: 'bg-amber-100', badgeText: 'text-amber-700' },
  { bg: 'bg-fuchsia-50/70', border: 'border-fuchsia-200', iconBg: 'bg-fuchsia-100', iconText: 'text-fuchsia-600', badgeBg: 'bg-fuchsia-100', badgeText: 'text-fuchsia-700' },
  { bg: 'bg-sky-50/70', border: 'border-sky-200', iconBg: 'bg-sky-100', iconText: 'text-sky-600', badgeBg: 'bg-sky-100', badgeText: 'text-sky-700' },
  { bg: 'bg-rose-50/70', border: 'border-rose-200', iconBg: 'bg-rose-100', iconText: 'text-rose-600', badgeBg: 'bg-rose-100', badgeText: 'text-rose-700' },
];

export const DigitalResources: React.FC<DigitalResourcesProps> = ({ isAdmin = true }) => {
  const [resources, setResources] = useState<DigitalResource[]>([]);
  const [links, setLinks] = useState<Resource[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [activeVideo, setActiveVideo] = useState<DigitalResource | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSaveLinkForm, setShowSaveLinkForm] = useState(false);

  // New resource form state
  const [newTitle, setNewTitle] = useState('');
  const [newGrade, setNewGrade] = useState(3);
  const [newVideoUrl, setNewVideoUrl] = useState('');

  const refreshResources = async () => {
    try {
      const [videoData, linkData] = await Promise.all([listResources('video'), listResources('link')]);
      setResources(
        videoData.map((r) => ({
          id: r.id,
          grade: r.grade || 1,
          title: r.title,
          lessonNumber: '',
          subject: `Khối ${r.grade || 1}`,
          duration: '',
          videoUrl: r.url,
          description: '',
          thumbnail: r.thumbnailUrl || PLACEHOLDER_THUMBNAIL,
          views: 0,
          materialsCount: 0,
        }))
      );
      setLinks(linkData);
    } catch (err) {
      console.error('Lỗi tải học liệu số:', err);
    }
  };

  useEffect(() => {
    refreshResources();
  }, []);

  const filteredResources = resources.filter(
    (res) => selectedGrade === 'all' || res.grade === selectedGrade
  );
  const filteredLinks = links.filter(
    (link) => selectedGrade === 'all' || link.grade === selectedGrade
  );

  const handleDeleteLink = async (id: string) => {
    if (!confirm('Xóa liên kết này?')) return;
    try {
      await deleteResource(id);
      await refreshResources();
    } catch (err: any) {
      alert(`Không thể xóa liên kết: ${err.message || 'Lỗi không xác định'}`);
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      await createResource({
        type: 'video',
        grade: newGrade,
        title: newTitle.trim(),
        url: newVideoUrl.trim() || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        thumbnailUrl: PLACEHOLDER_THUMBNAIL,
        isActive: true,
      });
      await refreshResources();
      setShowAddModal(false);
      setNewTitle('');
      setNewVideoUrl('');
    } catch (err: any) {
      alert(`Không thể thêm học liệu: ${err.message || 'Lỗi không xác định'}`);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
              Kho học liệu điện tử
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">Video bài giảng Khối 1 - 5</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">Học liệu số</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý liên kết video bài giảng, giáo án điện tử theo từng khối lớp
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowSaveLinkForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Lưu link website</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm liên kết video mới</span>
            </button>
          </div>
        )}
      </div>

      {showSaveLinkForm && (
        <SaveLinkForm
          type="link"
          grade={selectedGrade === 'all' ? 1 : selectedGrade}
          onSaved={() => {
            setShowSaveLinkForm(false);
            refreshResources();
          }}
          onCancel={() => setShowSaveLinkForm(false)}
        />
      )}

      {/* Grade Selector Dropdown */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
        <select
          value={selectedGrade}
          onChange={(e) => setSelectedGrade(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 cursor-pointer"
        >
          <option value="all">Tất cả các khối</option>
          {[1, 2, 3, 4, 5].map((grade) => (
            <option key={grade} value={grade}>
              Khối lớp {grade}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400 ml-auto mr-1 hidden sm:inline">
          {filteredResources.length} video bài giảng
        </span>
      </div>

      {/* Saved Website Links (separate from video lessons) - to bang voi the video ben duoi */}
      {filteredLinks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4 text-emerald-600" />
            </span>
            Liên kết trang web đã lưu
            <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              {filteredLinks.length}
            </span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredLinks.map((link, idx) => {
              const palette = LINK_CARD_COLORS[idx % LINK_CARD_COLORS.length];
              return (
                <div
                  key={link.id}
                  className={`group relative bg-white rounded-2xl border-2 ${palette.border} shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col justify-between`}
                >
                  <div>
                    {/* Thumbnail / Icon area - cung kich thuoc voi the video (aspect-video) */}
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      <div className={`relative aspect-video w-full ${palette.iconBg} overflow-hidden cursor-pointer flex items-center justify-center`}>
                        {link.thumbnailUrl ? (
                          <img
                            src={link.thumbnailUrl}
                            alt={link.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <ExternalLink className={`w-14 h-14 ${palette.iconText} opacity-70`} />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-white/90 text-slate-700 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="w-5 h-5" />
                          </div>
                        </div>
                        <div className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full ${palette.badgeBg} ${palette.badgeText} text-[11px] font-bold`}>
                          Khối {link.grade}
                        </div>
                      </div>
                    </a>

                    {/* Information */}
                    <div className="p-4 space-y-1">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block font-extrabold text-slate-900 text-base line-clamp-1 hover:text-emerald-700 transition-colors"
                      >
                        {link.title}
                      </a>
                      <span className="block text-xs text-slate-400 truncate">{link.url}</span>
                    </div>
                  </div>

                  {/* Bottom Meta */}
                  <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${palette.iconText} hover:underline font-bold flex items-center gap-1.5`}
                    >
                      <span>Mở liên kết</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteLink(link.id)}
                        className="text-slate-400 hover:text-rose-600 font-bold flex items-center gap-1 cursor-pointer"
                        title="Xóa liên kết"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resources Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredResources.map((res) => (
          <div
            key={res.id}
            className="group bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-purple-300 transition-all overflow-hidden flex flex-col justify-between"
          >
            <div>
              {/* Thumbnail */}
              <div
                onClick={() => setActiveVideo(res)}
                className="relative aspect-video w-full bg-slate-900 overflow-hidden cursor-pointer"
              >
                <img
                  src={res.thumbnail}
                  alt={res.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/90 text-purple-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-purple-600 ml-0.5" />
                  </div>
                </div>
                <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-purple-600/90 text-white text-[11px] font-bold">
                  Khối {res.grade}
                </div>
              </div>

              {/* Information */}
              <div className="p-4 space-y-2">
                <h4
                  onClick={() => setActiveVideo(res)}
                  className="font-bold text-slate-900 text-sm line-clamp-1 hover:text-purple-600 cursor-pointer"
                >
                  {res.title}
                </h4>
              </div>
            </div>

            {/* Bottom Meta */}
            <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end text-xs text-slate-500">
              <button
                onClick={() => setActiveVideo(res)}
                className="text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1"
              >
                <span>Xem bài giảng</span>
                <Play className="w-3 h-3 fill-purple-600" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Video Player Modal */}
      {activeVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded bg-purple-600 text-xs font-bold">
                  Khối {activeVideo.grade}
                </span>
                <h3 className="font-bold text-sm sm:text-base truncate max-w-md">
                  {activeVideo.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveVideo(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player Frame */}
            <div className="aspect-video bg-black w-full flex items-center justify-center relative">
              {activeVideo.videoUrl ? (
                <video
                  src={activeVideo.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-white text-center p-6">
                  <Play className="w-12 h-12 mx-auto mb-2 text-purple-400" />
                  <p>Trình phát video bài giảng đang kết nối...</p>
                </div>
              )}
            </div>

            {/* Video details & teacher attachments */}
            <div className="p-6 space-y-4 bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">{activeVideo.title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Khối {activeVideo.grade}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Resource Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-base">Thêm video bài giảng mới</h3>
            <form onSubmit={handleAddResource} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tên bài giảng</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Bài 3: Khám phá thế giới đa phương tiện"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Khối lớp</label>
                <select
                  value={newGrade}
                  onChange={(e) => setNewGrade(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {[1, 2, 3, 4, 5].map((g) => (
                    <option key={g} value={g}>
                      Khối {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Đường dẫn Video (URL)</label>
                <input
                  type="text"
                  placeholder="https://... hoặc link bài giảng"
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Lưu học liệu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
