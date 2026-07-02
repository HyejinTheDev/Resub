import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { VOICES, API_BASE_URL } from '../../shared/config/constants';
import { parseTimeToSeconds } from '../../shared/utils/timeFormatter';

export default function SubtitleList({ onSeek }) {
  const {
    subtitles,
    activeSubtitleIndex,
    setActiveSubtitleIndex,
    searchQuery,
    setSearchQuery,
    handleSubtitleTextChange,
    handleSubtitleVoiceChange,
    previewLoadingIndex,
    setPreviewLoadingIndex,
    showToast,
    saveHistory,
    handleDeleteSubtitle,
    setInspectorTab,
    handleAddSubtitle
  } = useProjectStore();

  const { capcutCookie } = useSettingsStore();
  const { ttsVolume, currentTime, defaultVoice } = usePlaybackStore();

  const handleAddNewSubtitleClick = () => {
    handleAddSubtitle(currentTime, defaultVoice);
    showToast('Đã thêm câu lời thoại mới tại thời điểm phát hiện tại!');
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputs = document.querySelectorAll('.translation-input');
      const currentInput = e.target;
      const inputsArray = Array.from(inputs);
      const currentPos = inputsArray.indexOf(currentInput);
      if (currentPos !== -1 && currentPos < inputsArray.length - 1) {
        inputsArray[currentPos + 1].focus();
        inputsArray[currentPos + 1].select();
      }
    }
  };

  const handleFocus = () => {
    saveHistory();
  };

  const handlePreviewVoice = async (index, e) => {
    e.stopPropagation();
    const sub = subtitles[index];
    if (!sub.text) {
      showToast('Nội dung phụ đề trống, không thể nghe thử!');
      return;
    }

    setPreviewLoadingIndex(index);
    try {
      const response = await fetch(`${API_BASE_URL}/tts-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sub.text,
          voice: sub.voice,
          capcutCookie
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Lỗi tạo âm thanh nghe thử');
      }

      const data = await response.json();
      const audio = new Audio(data.audioUrl);
      audio.volume = ttsVolume;
      await audio.play();
    } catch (error) {
      showToast(`Nghe thử thất bại: ${error.message}`);
    } finally {
      setPreviewLoadingIndex(-1);
    }
  };

  const filteredSubtitles = subtitles.map((sub, index) => ({ ...sub, originalIndex: index }))
    .filter(sub => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;

      const textMatch = (sub.chineseText && sub.chineseText.toLowerCase().includes(query)) ||
                         (sub.text && sub.text.toLowerCase().includes(query));
      if (textMatch) return true;

      const rawTimeMatch = (sub.startTime && sub.startTime.toLowerCase().includes(query)) ||
                            (sub.endTime && sub.endTime.toLowerCase().includes(query));
      if (rawTimeMatch) return true;

      const querySeconds = parseFloat(query);
      if (!isNaN(querySeconds)) {
        const start = parseTimeToSeconds(sub.startTime);
        const end = parseTimeToSeconds(sub.endTime);
        if (querySeconds >= start && querySeconds <= end) {
          return true;
        }
      }

      return false;
    });

  return (
    <section className="left-panel" style={{ width: '100%', height: '100%' }}>
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="panel-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          Danh sách phụ đề dịch thuật ({subtitles.length} câu)
        </span>
        <button 
          onClick={handleAddNewSubtitleClick}
          className="action-btn"
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.opacity = '0.9'}
          onMouseLeave={(e) => e.target.style.opacity = '1'}
        >
          ➕ Thêm câu
        </button>
      </div>

      <div className="search-bar-container">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input 
          type="text" 
          placeholder="Tìm kiếm chữ hoặc thời gian (vd: bệnh nhân, 02s, 3.5)..." 
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        )}
      </div>

      <div className="subtitle-list">
        {filteredSubtitles.map((sub) => {
          const i = sub.originalIndex;
          return (
            <div 
              key={i} 
              className={`subtitle-card ${activeSubtitleIndex === i ? 'active' : ''}`}
              onClick={() => {
                setActiveSubtitleIndex(i);
                onSeek(parseTimeToSeconds(sub.startTime));
                setInspectorTab('audio');
              }}
            >
              <div className="card-metadata" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="card-index">Câu {i + 1}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub.startTime} - {sub.endTime}</span>
                </div>
                <button
                  className="delete-sub-btn"
                  title="Xóa câu phụ đề & giọng lồng tiếng"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSubtitle(i);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '13px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s'
                  }}
                >
                  🗑️
                </button>
              </div>
              <div className="chinese-text">{sub.chineseText}</div>
              <input 
                type="text" 
                id={`sub-input-${i}`}
                className="translation-input"
                value={sub.text}
                onChange={(e) => handleSubtitleTextChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={handleFocus}
              />
              <div className="voice-select-container">
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <span style={{color: 'var(--text-muted)'}}>Giọng:</span>
                  <select 
                    className="voice-dropdown"
                    value={sub.voice}
                    onChange={(e) => handleSubtitleVoiceChange(i, e.target.value)}
                  >
                    {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <button 
                  className="preview-btn"
                  onClick={(e) => handlePreviewVoice(i, e)}
                  disabled={previewLoadingIndex === i}
                  title="Nghe thử giọng thuyết minh câu này"
                >
                  {previewLoadingIndex === i ? (
                    <div className="mini-spinner"></div>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '4px'}}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                  )}
                  {previewLoadingIndex === i ? 'Đang tạo...' : 'Nghe thử'}
                </button>
              </div>
            </div>
          );
        })}
        {filteredSubtitles.length === 0 && subtitles.length > 0 && (
          <p style={{textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '20px'}}>Không tìm thấy phụ đề nào khớp với từ khóa.</p>
        )}
      </div>
    </section>
  );
}
