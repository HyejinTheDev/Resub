import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';

export default function VideoTab() {
  const {
    videoTransform,
    setVideoTransform,
    cropStyle,
    setCropStyle,
    showToast,
    saveHistory
  } = useProjectStore();

  const { videoDimensions } = usePlaybackStore();

  return (
    <div className="inspector-section">
      <h3 className="section-title">Căn chỉnh Video</h3>
      
      {/* Zoom / Scale */}
      <div className="control-group" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="control-label" style={{ fontSize: '13px', fontWeight: 600 }}>Thu phóng (Scale)</span>
          <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold' }}>{videoTransform.zoom}%</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input 
            type="range" 
            min="50" 
            max="300" 
            value={videoTransform.zoom}
            onMouseDown={saveHistory}
            onChange={(e) => setVideoTransform(prev => ({ ...prev, zoom: parseInt(e.target.value) || 100 }))}
            className="volume-range-slider"
            style={{ flex: 1 }}
          />
          <input 
            type="number"
            min="50"
            max="300"
            value={videoTransform.zoom}
            onMouseDown={saveHistory}
            onChange={(e) => setVideoTransform(prev => ({ ...prev, zoom: Math.max(50, Math.min(300, parseInt(e.target.value) || 100)) }))}
            style={{
              width: '60px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: '#fff',
              borderRadius: '4px',
              padding: '4px 6px',
              fontSize: '12px',
              textAlign: 'center'
            }}
          />
        </div>
      </div>

      {/* Position Offset X */}
      <div className="control-group" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="control-label" style={{ fontSize: '13px', fontWeight: 600 }}>Vị trí X (Offset X)</span>
          <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold' }}>{videoTransform.xOffset}%</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input 
            type="range" 
            min="-100" 
            max="100" 
            value={videoTransform.xOffset}
            onMouseDown={saveHistory}
            onChange={(e) => setVideoTransform(prev => ({ ...prev, xOffset: parseInt(e.target.value) || 0 }))}
            className="volume-range-slider"
            style={{ flex: 1 }}
          />
          <input 
            type="number"
            min="-100"
            max="100"
            value={videoTransform.xOffset}
            onMouseDown={saveHistory}
            onChange={(e) => setVideoTransform(prev => ({ ...prev, xOffset: Math.max(-100, Math.min(100, parseInt(e.target.value) || 0)) }))}
            style={{
              width: '60px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: '#fff',
              borderRadius: '4px',
              padding: '4px 6px',
              fontSize: '12px',
              textAlign: 'center'
            }}
          />
        </div>
      </div>

      {/* Position Offset Y */}
      <div className="control-group" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="control-label" style={{ fontSize: '13px', fontWeight: 600 }}>Vị trí Y (Offset Y)</span>
          <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold' }}>{videoTransform.yOffset}%</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input 
            type="range" 
            min="-100" 
            max="100" 
            value={videoTransform.yOffset}
            onMouseDown={saveHistory}
            onChange={(e) => setVideoTransform(prev => ({ ...prev, yOffset: parseInt(e.target.value) || 0 }))}
            className="volume-range-slider"
            style={{ flex: 1 }}
          />
          <input 
            type="number"
            min="-100"
            max="100"
            value={videoTransform.yOffset}
            onMouseDown={saveHistory}
            onChange={(e) => setVideoTransform(prev => ({ ...prev, yOffset: Math.max(-100, Math.min(100, parseInt(e.target.value) || 0)) }))}
            style={{
              width: '60px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: '#fff',
              borderRadius: '4px',
              padding: '4px 6px',
              fontSize: '12px',
              textAlign: 'center'
            }}
          />
        </div>
      </div>

      {/* Rotation */}
      <div className="control-group" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="control-label" style={{ fontSize: '13px', fontWeight: 600 }}>Xoay (Rotate)</span>
          <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold' }}>{videoTransform.rotation}°</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input 
            type="range" 
            min="-180" 
            max="180" 
            value={videoTransform.rotation}
            onMouseDown={saveHistory}
            onChange={(e) => setVideoTransform(prev => ({ ...prev, rotation: parseInt(e.target.value) || 0 }))}
            className="volume-range-slider"
            style={{ flex: 1 }}
          />
          <input 
            type="number"
            min="-180"
            max="180"
            value={videoTransform.rotation}
            onMouseDown={saveHistory}
            onChange={(e) => setVideoTransform(prev => ({ ...prev, rotation: Math.max(-180, Math.min(180, parseInt(e.target.value) || 0)) }))}
            style={{
              width: '60px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: '#fff',
              borderRadius: '4px',
              padding: '4px 6px',
              fontSize: '12px',
              textAlign: 'center'
            }}
          />
        </div>
      </div>

      {/* Crop Aspect Ratio */}
      <div style={{
        marginBottom: '20px',
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)'
      }}>
        <span className="control-label" style={{ display: 'block', marginBottom: '10px', fontSize: '13px', fontWeight: 600 }}>Cắt xén theo tỷ lệ (Crop Aspect Ratio)</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
          {[
            { id: 'original', name: 'Gốc' },
            { id: '9:16', name: '9:16' },
            { id: '16:9', name: '16:9' },
            { id: '1:1', name: '1:1' }
          ].map(ratio => (
            <button
              key={ratio.id}
              style={{
                padding: '8px 4px',
                background: cropStyle.aspectRatio === ratio.id ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
                color: cropStyle.aspectRatio === ratio.id ? '#000' : 'var(--text-color)',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: cropStyle.aspectRatio === ratio.id ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => {
                saveHistory();
                const targetRatio = ratio.id === '9:16' ? 9/16 :
                                    ratio.id === '16:9' ? 16/9 : 1.0;
                const videoRatio = videoDimensions.width / videoDimensions.height || 16/9;
                
                let h = 100;
                let w = h * targetRatio / videoRatio;
                if (w > 100) {
                  const scale = 100 / w;
                  w = 100;
                  h = h * scale;
                }
                
                setCropStyle({
                  aspectRatio: ratio.id,
                  xPercent: 50,
                  yPercent: 50,
                  heightPercent: Math.round(h)
                });
              }}
            >
              {ratio.name}
            </button>
          ))}
        </div>

        {cropStyle.aspectRatio !== 'original' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span>Chiều cao vùng cắt:</span>
                <span>{cropStyle.heightPercent}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                value={cropStyle.heightPercent}
                onChange={(e) => {
                  const newH = parseInt(e.target.value);
                  setCropStyle(prev => {
                    const targetRatio = prev.aspectRatio === '9:16' ? 9/16 :
                                        prev.aspectRatio === '16:9' ? 16/9 : 1.0;
                    const videoRatio = videoDimensions.width / videoDimensions.height || 16/9;
                    
                    let tempH = newH;
                    let tempW = tempH * targetRatio / videoRatio;
                    if (tempW > 100) {
                      const scale = 100 / tempW;
                      tempW = 100;
                      tempH = tempH * scale;
                    }
                    
                    const halfW = tempW / 2;
                    const halfH = tempH / 2;
                    
                    const boundedX = Math.max(halfW, Math.min(100 - halfW, prev.xPercent));
                    const boundedY = Math.max(halfH, Math.min(100 - halfH, prev.yPercent));
                    
                    return {
                      ...prev,
                      heightPercent: Math.round(tempH),
                      xPercent: Math.round(boundedX),
                      yPercent: Math.round(boundedY)
                    };
                  });
                }}
                className="volume-range-slider"
              />
              <button
                style={{
                  padding: '6px 10px',
                  background: 'transparent',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  marginTop: '4px'
                }}
                onClick={() => {
                  const targetRatio = cropStyle.aspectRatio === '9:16' ? 9/16 :
                                      cropStyle.aspectRatio === '16:9' ? 16/9 : 1.0;
                  const videoRatio = videoDimensions.width / videoDimensions.height || 16/9;
                  
                  let h = 100;
                  let w = h * targetRatio / videoRatio;
                  if (w > 100) {
                    const scale = 100 / w;
                    w = 100;
                    h = h * scale;
                  }
                  setCropStyle({
                    aspectRatio: cropStyle.aspectRatio,
                    xPercent: 50,
                    yPercent: 50,
                    heightPercent: Math.round(h)
                  });
                }}
              >
                Đặt lại vị trí trung tâm
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reset Button */}
      <button
        className="reset-export-btn"
        style={{ width: '100%', padding: '10px', fontWeight: 'bold' }}
        onClick={() => {
          setVideoTransform({ zoom: 100, xOffset: 0, yOffset: 0, rotation: 0 });
          setCropStyle({ aspectRatio: 'original', xPercent: 50, yPercent: 50, heightPercent: 100 });
          showToast('Đã đặt lại toàn bộ căn chỉnh video về mặc định!');
        }}
      >
        Đặt lại toàn bộ căn chỉnh
      </button>
    </div>
  );
}
