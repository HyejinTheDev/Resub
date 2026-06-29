import React from 'react';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useProjectStore } from '../../store/useProjectStore';
import { VOICES } from '../../shared/config/constants';

export default function AudioTab() {
  const {
    bgVolume,
    setBgVolume,
    defaultVoice,
    setDefaultVoice
  } = usePlaybackStore();

  const { handleBulkVoiceChange } = useProjectStore();

  const onVoiceChange = (voiceId) => {
    setDefaultVoice(voiceId);
    handleBulkVoiceChange(voiceId);
  };

  return (
    <div className="inspector-section">
      <h3 className="section-title">Điều chỉnh âm lượng</h3>
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
    </div>
  );
}
