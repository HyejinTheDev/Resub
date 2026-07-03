import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { PRESET_COLORS } from '../../shared/config/constants';
import { formatSecondsToCustomTime } from '../../shared/utils/timeFormatter';

export default function MaskTab() {
  const {
    activeBlurIndex,
    blurMasks,
    setBlurMasks,
    handleDeleteBlurMask,
    handleAddBlurMask,
    saveHistory
  } = useProjectStore();

  const { currentTime, videoDuration } = usePlaybackStore();

  const createAndAddBlurMask = () => {
    const startSecs = currentTime;
    const endSecs = Math.min(videoDuration || 30, startSecs + 5);
    const newBlur = {
      id: `blur-${Date.now()}`,
      startTime: formatSecondsToCustomTime(startSecs),
      endTime: formatSecondsToCustomTime(endSecs),
      xPercentage: 50,
      yPercentage: 75,
      widthPercentage: 80,
      heightPercentage: 15,
      blurRadius: 15,
      color: '#000000',
      opacity: 0.15
    };
    handleAddBlurMask(newBlur);
  };

  const createFullVideoBlurMask = () => {
    const startSecs = 0;
    const endSecs = videoDuration || 300;
    const newBlur = {
      id: `blur-${Date.now()}`,
      startTime: formatSecondsToCustomTime(startSecs),
      endTime: formatSecondsToCustomTime(endSecs),
      xPercentage: 50,
      yPercentage: 75,
      widthPercentage: 80,
      heightPercentage: 15,
      blurRadius: 15,
      color: '#000000',
      opacity: 0.15
    };
    handleAddBlurMask(newBlur);
  };

  const setMaskToFullDuration = () => {
    saveHistory();
    const updatedMasks = blurMasks.map((m, idx) => 
      idx === activeBlurIndex 
        ? { 
            ...m, 
            startTime: formatSecondsToCustomTime(0), 
            endTime: formatSecondsToCustomTime(videoDuration || 300) 
          } 
        : m
    );
    setBlurMasks(updatedMasks);
  };

  const updateActiveMask = (field, value) => {
    setBlurMasks(blurMasks.map((m, idx) => 
      idx === activeBlurIndex ? { ...m, [field]: value } : m
    ));
  };

  return (
    <div className="inspector-section">
      <h3 className="section-title">Chọn kiểu làm mờ</h3>
      
      {activeBlurIndex !== -1 && blurMasks[activeBlurIndex] ? (
        <div className="mask-settings-panel">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <h4 className="control-label" style={{margin: 0, fontSize: '12px', fontWeight: 600}}>Tùy chỉnh phân đoạn làm mờ</h4>
            <button 
              onClick={() => handleDeleteBlurMask(activeBlurIndex)}
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Xóa phân đoạn
            </button>
          </div>
          
          <div style={{background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px'}}>
            <div>
              Thời gian: <strong>{blurMasks[activeBlurIndex].startTime}</strong> - <strong>{blurMasks[activeBlurIndex].endTime}</strong>
            </div>
            <button
              onClick={setMaskToFullDuration}
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 500,
                alignSelf: 'flex-start'
              }}
            >
              Kéo phủ toàn bộ video (0s - Hết) 📺
            </button>
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            <div>
              <div className="mask-setting-row">
                <span className="mask-setting-label">Vị trí dọc (Y)</span>
                <div className="mask-setting-input-wrapper">
                  <input 
                    type="number" 
                    min="5" 
                    max="95" 
                    value={blurMasks[activeBlurIndex].yPercentage}
                    onMouseDown={saveHistory}
                    onChange={(e) => {
                      const val = Math.max(5, Math.min(95, parseInt(e.target.value) || 0));
                      updateActiveMask('yPercentage', val);
                    }}
                    className="mask-number-input"
                  />
                  <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>%</span>
                </div>
              </div>
              <input 
                type="range"
                min="5"
                max="95"
                value={blurMasks[activeBlurIndex].yPercentage}
                onMouseDown={saveHistory}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  updateActiveMask('yPercentage', val);
                }}
                className="volume-range-slider"
              />
            </div>

            <div>
              <div className="mask-setting-row">
                <span className="mask-setting-label">Chiều cao thanh</span>
                <div className="mask-setting-input-wrapper">
                  <input 
                    type="number" 
                    min="5" 
                    max="50" 
                    value={blurMasks[activeBlurIndex].heightPercentage}
                    onMouseDown={saveHistory}
                    onChange={(e) => {
                      const val = Math.max(5, Math.min(50, parseInt(e.target.value) || 0));
                      updateActiveMask('heightPercentage', val);
                    }}
                    className="mask-number-input"
                  />
                  <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>%</span>
                </div>
              </div>
              <input 
                type="range"
                min="5"
                max="50"
                value={blurMasks[activeBlurIndex].heightPercentage}
                onMouseDown={saveHistory}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  updateActiveMask('heightPercentage', val);
                }}
                className="volume-range-slider"
              />
            </div>

            <div>
              <div className="mask-setting-row">
                <span className="mask-setting-label">Đo độ nhòe (Blur)</span>
                <div className="mask-setting-input-wrapper">
                  <input 
                    type="number" 
                    min="2" 
                    max="50" 
                    value={blurMasks[activeBlurIndex].blurRadius}
                    onMouseDown={saveHistory}
                    onChange={(e) => {
                      const val = Math.max(2, Math.min(50, parseInt(e.target.value) || 0));
                      updateActiveMask('blurRadius', val);
                    }}
                    className="mask-number-input"
                  />
                  <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>px</span>
                </div>
              </div>
              <input 
                type="range"
                min="2"
                max="50"
                value={blurMasks[activeBlurIndex].blurRadius}
                onMouseDown={saveHistory}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  updateActiveMask('blurRadius', val);
                }}
                className="volume-range-slider"
              />
            </div>

            <div style={{borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px'}}>
              <span className="mask-setting-label" style={{display: 'block', marginBottom: '8px'}}>Màu sắc dải che</span>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
                {PRESET_COLORS.map(c => (
                  <button 
                    key={c.value}
                    className={`color-preset-circle ${blurMasks[activeBlurIndex].color === c.value ? 'active' : ''}`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => {
                      saveHistory();
                      updateActiveMask('color', c.value);
                    }}
                    title={c.name}
                  />
                ))}
                
                <div className="custom-color-picker-wrapper" title="Màu tự chọn">
                  <input 
                    type="color" 
                    value={blurMasks[activeBlurIndex].color}
                    onMouseDown={saveHistory}
                    onChange={(e) => updateActiveMask('color', e.target.value)}
                    className="custom-color-picker-input"
                  />
                  <span style={{fontSize: '11px', color: 'var(--text-muted)'}}>Tự chọn</span>
                </div>
              </div>
            </div>

            <div>
              <div className="mask-setting-row">
                <span className="mask-setting-label">Đo mờ đục (Opacity)</span>
                <div className="mask-setting-input-wrapper">
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={Math.round(blurMasks[activeBlurIndex].opacity * 100)}
                    onMouseDown={saveHistory}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) / 100;
                      updateActiveMask('opacity', val);
                    }}
                    className="mask-number-input"
                  />
                  <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>%</span>
                </div>
              </div>
              <input 
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={blurMasks[activeBlurIndex].opacity}
                onMouseDown={saveHistory}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  updateActiveMask('opacity', val);
                }}
                className="volume-range-slider"
              />
            </div>
          </div>

          <p className="control-help" style={{marginTop: '16px'}}>💡 Bạn cũng có thể nhấn giữ và kéo trực tiếp dải làm mờ trên màn hình video để thay đổi vị trí Y, hoặc co kéo biên trên/dưới của nó!</p>
        </div>
      ) : (
        <div style={{textAlign: 'center', padding: '24px 16px', border: '1.5px dashed var(--border-color)', borderRadius: '12px'}}>
          <p style={{color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px'}}>
            💡 Chưa chọn phân đoạn làm mờ nào hoặc chưa tạo dải làm mờ!
          </p>
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center'}}>
            <button 
              className="action-btn" 
              onClick={createAndAddBlurMask}
              style={{
                width: '100%',
                background: 'var(--accent)',
                color: '#000',
                fontWeight: 'bold',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 16px',
                cursor: 'pointer'
              }}
            >
              Thêm làm mờ phân đoạn (+)
            </button>
            <button 
              className="action-btn" 
              onClick={createFullVideoBlurMask}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontWeight: 'bold',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '10px 16px',
                cursor: 'pointer'
              }}
            >
              Làm mờ toàn bộ video (0s - Hết) 📺
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
