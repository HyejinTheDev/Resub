import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { API_BASE_URL } from '../../shared/config/constants';

export default function ExportTab() {
  const {
    subtitles,
    videoData,
    isExporting,
    setIsExporting,
    exportedVideoUrl,
    setExportedVideoUrl,
    blurMasks,
    subtitleStyle,
    cropStyle,
    setCropStyle,
    videoTransform,
    showToast
  } = useProjectStore();

  const { capcutCookie } = useSettingsStore();
  const { bgVolume, ttsVolume, videoDimensions, defaultVoice } = usePlaybackStore();

  const [exportResolution, setExportResolution] = useState('720p');
  const [exportQuality, setExportQuality] = useState('low');
  const [burnSubtitles, setBurnSubtitles] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [currentExportId, setCurrentExportId] = useState(null);

  const getCropDimensions = () => {
    if (cropStyle.aspectRatio === 'original') {
      return { w: 100, h: 100 };
    }
    const targetRatio = cropStyle.aspectRatio === '9:16' ? 9/16 :
                        cropStyle.aspectRatio === '16:9' ? 16/9 : 1.0;
    const videoRatio = videoDimensions.width / videoDimensions.height || 16/9;
    
    let h = cropStyle.heightPercent;
    let w = h * targetRatio / videoRatio;
    
    if (w > 100) {
      const scale = 100 / w;
      w = 100;
      h = h * scale;
    }
    return { w: Math.round(w), h: Math.round(h) };
  };

  const handleAspectRatioChange = (aspectRatioId) => {
    if (aspectRatioId === 'original') {
      setCropStyle({
        aspectRatio: 'original',
        xPercent: 50,
        yPercent: 50,
        widthPercent: 100,
        heightPercent: 100
      });
      return;
    }
    const targetRatio = aspectRatioId === '9:16' ? 9/16 :
                        aspectRatioId === '16:9' ? 16/9 : 1.0;
    const videoRatio = videoDimensions.width / videoDimensions.height || 16/9;
    
    let h = 100;
    let w = h * targetRatio / videoRatio;
    if (w > 100) {
      const scale = 100 / w;
      w = 100;
      h = h * scale;
    }
    setCropStyle({
      aspectRatio: aspectRatioId,
      xPercent: 50,
      yPercent: 50,
      widthPercent: Math.round(w),
      heightPercent: Math.round(h)
    });
  };

  const handleExportVideo = async () => {
    if (subtitles.length === 0 || !videoData) return;
    setIsExporting(true);
    setExportedVideoUrl('');

    try {
      const response = await fetch(`${API_BASE_URL}/dub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoPath: videoData.videoPath,
          subtitles,
          voice: defaultVoice,
          bgVolume,
          ttsVolume,
          blurMasks,
          subtitleStyle,
          capcutCookie,
          cropStyle: {
            aspectRatio: cropStyle.aspectRatio,
            xPercent: cropStyle.xPercent,
            yPercent: cropStyle.yPercent,
            widthPercent: getCropDimensions().w,
            heightPercent: getCropDimensions().h
          },
          videoTransform,
          exportResolution,
          exportQuality,
          burnSubtitles
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || (response.status === 503
          ? 'Máy chủ đang quá tải. Vui lòng thử lại sau vài phút.'
          : 'Failed to export dubbed video'));
      }

      const { exportId } = await response.json();
      setCurrentExportId(exportId);

      // Poll export progress until done/error/cancelled (export runs in background on server)
      const finalStatus = await new Promise((resolve, reject) => {
        let notFoundCount = 0;
        const poll = async () => {
          try {
            const statusRes = await fetch(`${API_BASE_URL}/dub-status?exportId=${exportId}`);
            if (statusRes.status === 404) {
              // Task vanished — server was likely redeployed/restarted mid-export
              notFoundCount++;
              if (notFoundCount >= 3) {
                reject(new Error('Máy chủ vừa khởi động lại nên tác vụ xuất video bị mất. Vui lòng thử xuất lại.'));
                return;
              }
              setTimeout(poll, 5000);
              return;
            }
            if (!statusRes.ok) {
              // Transient errors (e.g. 502 while server is busy) — keep polling
              setTimeout(poll, 5000);
              return;
            }
            notFoundCount = 0;
            const status = await statusRes.json();
            if (status.status === 'done') {
              resolve(status);
            } else if (status.status === 'cancelled') {
              reject(new Error('EXPORT_CANCELLED'));
            } else if (status.status === 'error') {
              reject(new Error(status.error || 'Xuất video thất bại trên máy chủ'));
            } else {
              setExportProgress(status);
              setTimeout(poll, 3000);
            }
          } catch {
            setTimeout(poll, 5000);
          }
        };
        poll();
      });

      setExportProgress(null);
      setExportedVideoUrl(finalStatus.videoUrl);
      showToast('Xuất video lồng tiếng thành công! Bạn có thể tải video về.');
    } catch (error) {
      setExportProgress(null);
      if (error.message === 'EXPORT_CANCELLED') {
        showToast('Đã hủy xuất video.');
      } else {
        showToast(`Lỗi xuất video: ${error.message}`);
      }
    } finally {
      setIsExporting(false);
      setCurrentExportId(null);
    }
  };

  const handleCancelExport = async () => {
    if (!currentExportId) return;
    try {
      await fetch(`${API_BASE_URL}/dub-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportId: currentExportId })
      });
      // The polling loop will pick up the 'cancelled' status and reset the UI
    } catch (error) {
      showToast(`Không hủy được: ${error.message}`);
    }
  };

  return (
    <div className="inspector-section" style={{ padding: '16px' }}>
      <h3 className="section-title" style={{ marginBottom: '16px' }}>Xuất video lồng tiếng</h3>
      
      <div className="export-info-box" style={{ marginBottom: '20px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
        Tiến hành tổng hợp thuyết minh tiếng Việt, điều chỉnh tốc độ khớp hình ảnh và chèn phụ đề.
      </div>

      {!exportedVideoUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          {/* Tỷ lệ khung hình */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Tỷ lệ khung hình (Aspect Ratio)</label>
            <select 
              className="inspector-select"
              value={cropStyle.aspectRatio}
              onChange={(e) => handleAspectRatioChange(e.target.value)}
              style={{ width: '100%', padding: '8px', background: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px' }}
            >
              <option value="original">Giữ nguyên tỷ lệ gốc</option>
              <option value="9:16">Dọc 9:16 (TikTok, Reels, Shorts)</option>
              <option value="16:9">Ngang 16:9 (YouTube, Facebook)</option>
              <option value="1:1">Vuông 1:1 (Instagram)</option>
            </select>
          </div>

          {/* Độ phân giải */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Độ phân giải xuất (Resolution)</label>
            <select 
              className="inspector-select"
              value={exportResolution}
              onChange={(e) => setExportResolution(e.target.value)}
              style={{ width: '100%', padding: '8px', background: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px' }}
            >
              <option value="original">Gốc (Không thay đổi độ phân giải)</option>
              <option value="1080p">1080p (Sắc nét Full HD)</option>
              <option value="720p">720p (HD — xuất nhanh hơn, khuyên dùng)</option>
              <option value="480p">480p (Thấp / Xuất rất nhanh)</option>
            </select>
          </div>

          {/* Chất lượng nén */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Chất lượng nén (Quality CRF)</label>
            <select 
              className="inspector-select"
              value={exportQuality}
              onChange={(e) => setExportQuality(e.target.value)}
              style={{ width: '100%', padding: '8px', background: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px' }}
            >
              <option value="high">Cao (Chất lượng tốt, xuất chậm hơn)</option>
              <option value="medium">Trung bình (Cân bằng)</option>
              <option value="low">Thấp (Xuất nhanh nhất — khuyên dùng)</option>
            </select>
          </div>

          {/* Chèn phụ đề cứng */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <input 
              type="checkbox"
              id="burnSubtitles"
              checked={burnSubtitles}
              onChange={(e) => setBurnSubtitles(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)' }}
            />
            <label htmlFor="burnSubtitles" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              Chèn cứng phụ đề vào video (Xuất chậm hơn)
            </label>
          </div>
        </div>
      )}

      {!exportedVideoUrl ? (
        <>
          <button 
            className="action-btn export-run-btn"
            onClick={handleExportVideo}
            disabled={isExporting}
            style={{ width: '100%', padding: '12px', background: 'var(--accent)', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            {isExporting ? 'Đang tổng hợp thuyết minh...' : 'Khởi chạy xuất video'}
          </button>
          {isExporting && exportProgress && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${exportProgress.percent || 0}%`, background: 'var(--accent)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
              </div>
              <p style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                {exportProgress.percent || 0}% — {exportProgress.message || 'Đang xử lý...'}
              </p>
              <button
                className="cancel-export-btn"
                onClick={handleCancelExport}
                style={{ display: 'block', width: '100%', marginTop: '10px', padding: '10px', background: 'transparent', color: '#f87171', fontWeight: 600, border: '1px solid #f87171', borderRadius: '6px', cursor: 'pointer' }}
              >
                Hủy xuất video
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="export-success-box" style={{ padding: '16px', background: 'rgba(34,197,94,0.05)', border: '1px solid var(--accent)', borderRadius: '8px', textAlign: 'center' }}>
          <p className="success-text" style={{ color: 'var(--accent)', fontWeight: 'bold', marginBottom: '16px' }}>🎉 Xuất video thành công!</p>
          <a 
            href={exportedVideoUrl}
            download="resub_dubbed_video.mp4"
            className="action-btn export-download-btn"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', textDecoration: 'none', padding: '12px', background: 'var(--accent)', color: '#000', fontWeight: 'bold', borderRadius: '6px', marginBottom: '12px' }}
          >
            Tải Video (.mp4)
          </a>
          <button 
            className="reset-export-btn"
            onClick={() => setExportedVideoUrl('')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
          >
            Hủy & Chỉnh sửa tiếp
          </button>
        </div>
      )}
    </div>
  );
}
