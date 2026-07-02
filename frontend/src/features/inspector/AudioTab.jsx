import React from 'react';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useProjectStore } from '../../store/useProjectStore';
import { VOICES } from '../../shared/config/constants';

export default function AudioTab() {
  const {
    bgVolume,
    setBgVolume,
    ttsVolume,
    setTtsVolume,
    defaultVoice,
    setDefaultVoice
  } = usePlaybackStore();

  const { 
    subtitles,
    activeSubtitleIndex,
    handleSubtitleVoiceChange,
    handleBulkVoiceChange 
  } = useProjectStore();

  const onVoiceChange = (voiceId) => {
    setDefaultVoice(voiceId);
    handleBulkVoiceChange(voiceId);
  };

  return (
    <div className="inspector-section">
      <h3 className="section-title">Điều chỉnh âm lượng</h3>
      
      {/* Original video volume */}
      <div className="control-group">
        <label className="control-label">Âm lượng video gốc</label>
        <div className="volume-control-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05"
            value={bgVolume}
            onChange={(e) => setBgVolume(parseFloat(e.target.value))}
            className="volume-range-slider"
          />
          <span className="volume-percentage">{Math.round(bgVolume * 100)}%</span>
        </div>
      </div>

      {/* Voiceover volume */}
      <div className="control-group" style={{marginTop: '16px'}}>
        <label className="control-label">Âm lượng lồng tiếng</label>
        <div className="volume-control-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          <input 
            type="range" 
            min="0" 
            max="2" 
            step="0.05"
            value={ttsVolume}
            onChange={(e) => setTtsVolume(parseFloat(e.target.value))}
            className="volume-range-slider"
          />
          <span className="volume-percentage">{Math.round(ttsVolume * 100)}%</span>
        </div>
      </div>

      <div className="control-group" style={{marginTop: '24px'}}>
        <label className="control-label">Giọng thuyết minh mặc định</label>
        <select 
          className="inspector-select"
          value={defaultVoice}
          onChange={(e) => onVoiceChange(e.target.value)}
        >
          {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <p className="control-help">Thay đổi giọng này sẽ lập tức cập nhật cho tất cả phân đoạn phụ đề.</p>
      </div>

      {/* Selected Segment Voice */}
      {activeSubtitleIndex !== -1 && subtitles[activeSubtitleIndex] && (
        <div className="control-group" style={{
          marginTop: '24px', 
          padding: '14px', 
          background: 'rgba(255,255,255,0.02)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '8px'
        }}>
          <label className="control-label" style={{color: 'var(--accent)', fontWeight: 'bold'}}>Giọng đọc riêng câu {activeSubtitleIndex + 1}</label>
          <select 
            className="inspector-select"
            value={subtitles[activeSubtitleIndex].voice || defaultVoice}
            onChange={(e) => handleSubtitleVoiceChange(activeSubtitleIndex, e.target.value)}
            style={{marginTop: '8px'}}
          >
            {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <p className="control-help" style={{fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px'}}>
            Thay đổi giọng này chỉ áp dụng riêng cho câu thoại đang được chọn.
          </p>
        </div>
      )}
    </div>
  );
}
