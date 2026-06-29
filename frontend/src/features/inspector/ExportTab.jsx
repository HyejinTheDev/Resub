import React from 'react';
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
    videoTransform,
    showToast
  } = useProjectStore();

  const { fptApiKey, capcutCookie } = useSettingsStore();
  const { bgVolume, videoDimensions } = usePlaybackStore();

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
          bgVolume,
          blurMasks,
          subtitleStyle,
          fptApiKey,
          capcutCookie,
          cropStyle: {
            aspectRatio: cropStyle.aspectRatio,
            xPercent: cropStyle.xPercent,
            yPercent: cropStyle.yPercent,
            widthPercent: getCropDimensions().w,
            heightPercent: getCropDimensions().h
          },
          videoTransform
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to export dubbed video');
      }

      const data = await response.json();
      setExportedVideoUrl(data.videoUrl);
      showToast('Xuất video lồng tiếng thành công! Bạn có thể tải video về.');
    } catch (error) {
      showToast(`Lỗi xuất video: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="inspector-section">
      <h3 className="section-title">Xuất video lồng tiếng</h3>
      
      <div className="export-info-box">
        Tiến hành tổng hợp thuyết minh tiếng Việt, điều chỉnh tốc độ khớp hình ảnh và chèn phụ đề.
      </div>

      {!exportedVideoUrl ? (
        <button 
          className="action-btn export-run-btn"
          onClick={handleExportVideo}
          disabled={isExporting}
        >
          {isExporting ? 'Đang tổng hợp thuyết minh...' : 'Khởi chạy xuất video'}
        </button>
      ) : (
        <div className="export-success-box">
          <p className="success-text">🎉 Xuất video thành công!</p>
          <a 
            href={exportedVideoUrl}
            download="resub_dubbed_video.mp4"
            className="action-btn export-download-btn"
            target="_blank"
            rel="noopener noreferrer"
          >
            Tải Video (.mp4)
          </a>
          <button 
            className="reset-export-btn"
            onClick={() => setExportedVideoUrl('')}
          >
            Hủy & Chỉnh sửa tiếp
          </button>
        </div>
      )}
    </div>
  );
}
