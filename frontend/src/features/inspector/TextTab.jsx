import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { TEXT_PRESETS } from '../../shared/config/constants';

export default function TextTab() {
  const {
    subtitles,
    setSubtitles,
    activeSubtitleIndex,
    subtitleStyle,
    setSubtitleStyle
  } = useProjectStore();

  return (
    <div className="inspector-section">
      <h3 className="section-title">Chỉnh sửa phụ đề</h3>
      
      {activeSubtitleIndex !== -1 && subtitles[activeSubtitleIndex] ? (
        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
          <div className="control-group">
            <label className="control-label">Nội dung phụ đề</label>
            <textarea 
              className="inspector-textarea" 
              style={{
                width: '100%',
                minHeight: '80px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-main)',
                padding: '10px',
                fontSize: '13px',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              value={subtitles[activeSubtitleIndex].text}
              onChange={(e) => {
                const newText = e.target.value;
                setSubtitles(subtitles.map((sub, idx) => 
                  idx === activeSubtitleIndex ? { ...sub, text: newText } : sub
                ));
              }}
            />
          </div>

          <div className="control-group">
            <div className="mask-setting-row">
              <span className="mask-setting-label">Cỡ chữ (Font Size)</span>
              <div className="mask-setting-input-wrapper">
                <input 
                  type="number" 
                  min="10" 
                  max="60" 
                  value={subtitleStyle.fontSize}
                  onChange={(e) => setSubtitleStyle(prev => ({ ...prev, fontSize: Math.max(10, Math.min(60, parseInt(e.target.value) || 0)) }))}
                  className="mask-number-input"
                />
                <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>px</span>
              </div>
            </div>
            <input 
              type="range"
              min="10"
              max="60"
              value={subtitleStyle.fontSize}
              onChange={(e) => setSubtitleStyle(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
              className="volume-range-slider"
            />
          </div>

          <div className="control-group">
            <span className="control-label" style={{marginBottom: '10px', display: 'block'}}>Kiểu mặc định</span>
            <div className="text-preset-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '10px'
            }}>
              {TEXT_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  className={`text-preset-btn ${subtitleStyle.textColorPreset === preset.id ? 'active' : ''}`}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: subtitleStyle.textColorPreset === preset.id ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '8px 4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setSubtitleStyle(prev => ({
                    ...prev,
                    textColorPreset: preset.id,
                    color: preset.color,
                    outlineColor: preset.outlineColor,
                    outlineWidth: preset.outlineWidth,
                    bg: preset.bg,
                    shadow: preset.shadow
                  }))}
                >
                  <span style={{
                    fontSize: '15px',
                    fontWeight: 'bold',
                    color: preset.color,
                    textShadow: preset.shadow ? '0 1px 2px rgba(0,0,0,0.8)' : 'none',
                    backgroundColor: preset.bg !== 'transparent' ? '#111' : 'transparent',
                    padding: preset.bg !== 'transparent' ? '2px 4px' : '0',
                    borderRadius: '2px'
                  }}>
                    Aa
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="control-group" style={{display: 'flex', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px'}}>
            <button
              className={`inspector-btn-style ${subtitleStyle.bold ? 'active' : ''}`}
              style={{
                flex: 1,
                padding: '8px',
                background: subtitleStyle.bold ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-tertiary)',
                border: subtitleStyle.bold ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                borderRadius: '6px',
                color: subtitleStyle.bold ? 'var(--accent)' : 'var(--text-main)',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
              onClick={() => setSubtitleStyle(prev => ({ ...prev, bold: !prev.bold }))}
            >
              B
            </button>
            <button
              className={`inspector-btn-style ${subtitleStyle.italic ? 'active' : ''}`}
              style={{
                flex: 1,
                padding: '8px',
                background: subtitleStyle.italic ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-tertiary)',
                border: subtitleStyle.italic ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                borderRadius: '6px',
                color: subtitleStyle.italic ? 'var(--accent)' : 'var(--text-main)',
                fontStyle: 'italic',
                cursor: 'pointer'
              }}
              onClick={() => setSubtitleStyle(prev => ({ ...prev, italic: !prev.italic }))}
            >
              I
            </button>
          </div>
        </div>
      ) : (
        <div className="help-card-panel" style={{
          padding: '24px 16px',
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px dashed var(--border-color)',
          borderRadius: '12px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '13px'
        }}>
          <p style={{marginBottom: '10px'}}>💡 Chưa chọn đoạn phụ đề nào!</p>
          <p>Vui lòng click chọn một đoạn phụ đề trên danh sách bên trái hoặc trên Timeline để bắt đầu chỉnh sửa nội dung và kiểu chữ trực quan.</p>
        </div>
      )}
    </div>
  );
}
