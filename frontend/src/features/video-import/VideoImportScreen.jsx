import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { API_BASE_URL } from '../../shared/config/constants';

export default function VideoImportScreen() {
  const [activeTab, setActiveTab] = useState('url');
  const [videoUrlInput, setVideoUrlInput] = useState('');

  const { geminiKey } = useSettingsStore();
  const { defaultVoice } = usePlaybackStore();
  
  const {
    setIsProcessing,
    setStatusMessage,
    setVideoData,
    setSubtitles,
    showToast
  } = useProjectStore();

  const handleTranscribe = async (audioPath) => {
    if (!geminiKey) {
      showToast('Vui lòng nhập Gemini API Key để dịch thuật phụ đề!');
      setIsProcessing(false);
      return;
    }

    setStatusMessage('Gemini AI đang lắng nghe tiếng Trung & dịch sang tiếng Việt...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioPath, geminiKey })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to transcribe audio');
      }

      const data = await response.json();
      const populatedSubs = data.subtitles.map(sub => ({
        ...sub,
        voice: defaultVoice
      }));
      setSubtitles(populatedSubs);
      showToast(`Hoàn tất! Đã tạo ${populatedSubs.length} phân đoạn thuyết minh.`);
    } catch (error) {
      showToast(`Lỗi nhận dạng: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!videoUrlInput) return;
    setIsProcessing(true);
    setStatusMessage('Đang tải video từ liên kết (yt-dlp)...');
    setVideoData(null);
    setSubtitles([]);

    try {
      const response = await fetch(`${API_BASE_URL}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrlInput })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to download video');
      }

      const data = await response.json();
      setVideoData(data);
      showToast('Tải video và trích xuất âm thanh thành công!');
      
      await handleTranscribe(data.audioPath);
    } catch (error) {
      showToast(`Lỗi: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsProcessing(true);
    setStatusMessage('Đang tải lên video và trích xuất âm thanh...');
    setVideoData(null);
    setSubtitles([]);

    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to upload video');
      }

      const data = await response.json();
      setVideoData(data);
      showToast('Tải video cục bộ thành công!');
      
      await handleTranscribe(data.audioPath);
    } catch (error) {
      showToast(`Lỗi: ${error.message}`);
      setIsProcessing(false);
    }
  };

  return (
    <main className="setup-view">
      <div className="setup-card">
        <h2 className="setup-title">Lồng Tiếng Video Trung - Việt</h2>
        <p className="setup-subtitle">Tự động dịch thuật phụ đề bằng Gemini AI và lồng tiếng khớp mốc thời gian</p>

        <div className="tabs-header">
          <button 
            className={`tab-btn ${activeTab === 'url' ? 'active' : ''}`}
            onClick={() => setActiveTab('url')}
          >
            Nhập Link Video
          </button>
          <button 
            className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            Tải File Lên
          </button>
        </div>

        {activeTab === 'url' ? (
          <div className="input-group">
            <input 
              type="text" 
              placeholder="Dán link Douyin, TikTok, hoặc YouTube..." 
              className="url-input"
              value={videoUrlInput}
              onChange={(e) => setVideoUrlInput(e.target.value)}
            />
            <button 
              className="action-btn"
              onClick={handleDownload}
              disabled={!videoUrlInput || !geminiKey}
            >
              Tải & Lồng Tiếng
            </button>
          </div>
        ) : (
          <div>
            <label className="upload-zone" htmlFor="video-upload-file">
              <div className="upload-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              </div>
              <p style={{fontWeight: 500, marginBottom: '6px'}}>Kéo thả hoặc nhấp để chọn file video</p>
              <p style={{fontSize: '12px', color: 'var(--text-muted)'}}>Hỗ trợ MP4, MKV, AVI, v.v.</p>
              <input 
                type="file" 
                id="video-upload-file" 
                style={{display: 'none'}} 
                accept="video/*"
                onChange={handleFileUpload}
                disabled={!geminiKey}
              />
            </label>
          </div>
        )}
        {!geminiKey && (
          <p style={{color: '#f87171', fontSize: '13px', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            Vui lòng nhập Gemini Key ở góc trên bên phải trước khi tải video.
          </p>
        )}
      </div>
    </main>
  );
}
