import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { API_BASE_URL } from '../../shared/config/constants';

export default function VideoImportScreen() {
  const { geminiKey } = useSettingsStore();
  const { defaultVoice } = usePlaybackStore();
  
  const {
    setIsProcessing,
    setStatusMessage,
    setVideoData,
    setSubtitles,
    showToast,
    uploadProgress,
    setUploadProgress,
    subtitleStyle,
    setSubtitleStyle
  } = useProjectStore();

  // Split Video States
  const [splitFile, setSplitFile] = useState(null);
  const [segmentMinutes, setSegmentMinutes] = useState(5);
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitSegments, setSplitSegments] = useState([]);
  const [splittingStatus, setSplittingStatus] = useState('');

  // Helper function to track file upload progress
  const uploadWithProgress = (url, formData, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.response));
        } else {
          try {
            reject(new Error(JSON.parse(xhr.response).error || 'Yêu cầu tải lên thất bại'));
          } catch {
            reject(new Error('Yêu cầu tải lên thất bại'));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Lỗi kết nối mạng'));
      xhr.send(formData);
    });
  };

  const validateVideoDuration = (file, onSuccess) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      const duration = video.duration;
      if (duration > 300) {
        showToast('Video quá dài! Thời lượng tối đa cho phép tải lên là 5 phút (300 giây).');
      } else {
        onSuccess();
      }
    };
    video.onerror = () => {
      onSuccess();
    };
    video.src = URL.createObjectURL(file);
  };

  const handleSplitFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSplitFile(file);
      setSplitSegments([]);
      e.target.value = null;
    }
  };

  const handleStartSplit = async () => {
    if (!splitFile) return;
    setIsSplitting(true);
    setSplittingStatus('Đang tải video lên: 0%');
    setSplitSegments([]);

    const formData = new FormData();
    formData.append('video', splitFile);
    formData.append('segmentMinutes', segmentMinutes);

    try {
      const data = await uploadWithProgress(`${API_BASE_URL}/split-video`, formData, (percent) => {
        if (percent < 100) {
          setSplittingStatus(`Đang tải video lên: ${percent}%`);
        } else {
          setSplittingStatus('Đang phân chia video bằng FFmpeg (copy không nén)...');
        }
      });

      setSplitSegments(data.segments);
      showToast(`Chia nhỏ video thành ${data.segments.length} phần thành công!`);
    } catch (error) {
      showToast(`Lỗi: ${error.message}`);
    } finally {
      setIsSplitting(false);
    }
  };

  const handleTranscribe = (audioPath, videoPath) => {
    return new Promise((resolve, reject) => {
      const taskId = `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      setStatusMessage('Đang khởi tạo dịch thuật phụ đề...');
      setUploadProgress(5);

      fetch(`${API_BASE_URL}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioPath, videoPath, geminiKey, taskId })
      })
      .then(async (response) => {
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || (response.status === 503
            ? 'Máy chủ đang quá tải. Vui lòng thử lại sau vài phút.'
            : 'Failed to start transcription'));
        }
        return response.json();
      })
      .then(() => {
        // Start polling every 1.5 seconds
        let notFoundCount = 0;
        const pollInterval = setInterval(() => {
          fetch(`${API_BASE_URL}/transcribe-status?taskId=${taskId}`)
            .then(res => {
              if (res.status === 404) {
                // Task vanished — server was likely redeployed/restarted mid-task
                notFoundCount++;
                if (notFoundCount >= 3) {
                  clearInterval(pollInterval);
                  reject(new Error('Máy chủ vừa khởi động lại nên tác vụ dịch bị mất. Vui lòng tải video lên và thử lại.'));
                }
                return null;
              }
              if (!res.ok) throw new Error('Status query failed');
              return res.json();
            })
            .then(statusData => {
              if (!statusData) return;
              notFoundCount = 0;
              if (statusData.status === 'done') {
                clearInterval(pollInterval);
                setUploadProgress(100);
                resolve({
                  subtitles: statusData.subtitles,
                  detectedPosition: statusData.detectedPosition
                });
              } else if (statusData.status === 'error') {
                clearInterval(pollInterval);
                reject(new Error(statusData.error || 'Lỗi nhận dạng tiếng Trung'));
              } else {
                setUploadProgress(statusData.percent || 50);
                setStatusMessage(statusData.message || 'AI đang xử lý...');
              }
            })
            .catch(err => {
              console.error('Polling error:', err);
            });
        }, 1500);
      })
      .catch((err) => {
        reject(err);
      });
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    validateVideoDuration(file, async () => {
      setIsProcessing(true);
      setUploadProgress(0);
      setStatusMessage('Đang tải video lên: 0%');
      setVideoData(null);
      setSubtitles([]);

      const formData = new FormData();
      formData.append('video', file);

      try {
        const data = await uploadWithProgress(`${API_BASE_URL}/upload`, formData, (percent) => {
          setUploadProgress(percent);
          if (percent < 100) {
            setStatusMessage(`Đang tải video lên: ${percent}%`);
          } else {
            setStatusMessage('Tải video hoàn tất! Đang trích xuất nhạc nền...');
          }
        });

        setUploadProgress(0);
        const result = await handleTranscribe(data.audioPath, data.videoPath);
        
        if (result && result.subtitles) {
          const { subtitles: subs, detectedPosition } = result;
          const detectedY = detectedPosition ? detectedPosition.yPercentage : 85;
          const detectedHeight = detectedPosition ? detectedPosition.heightPercentage : 15;

          // Stamp every segment with the chosen default voice so UI and export stay in sync
          setSubtitles(subs.map(s => ({ ...s, voice: s.voice || defaultVoice })));
          
          setVideoData({
            ...data,
            detectedSubtitleY: detectedY,
            detectedSubtitleHeight: detectedHeight
          });

          // Align the default subtitleStyle Y offset to overlay or replace the detected Y coordinate and reset default font size to 10
          setSubtitleStyle({
            ...subtitleStyle,
            fontSize: 10,
            yPercent: detectedY
          });

          showToast(`Hoàn tất! Đã tạo ${subs.length} phân đoạn thuyết minh.`);
        }
      } catch (error) {
        showToast(`Lỗi: ${error.message}`);
      } finally {
        setIsProcessing(false);
        setUploadProgress(0);
      }
    });

    e.target.value = null;
  };

  const handleLoadSegmentAsProject = async (filePath) => {
    setIsProcessing(true);
    setStatusMessage('Đang chuẩn bị phân đoạn video...');
    setVideoData(null);
    setSubtitles([]);

    try {
      const response = await fetch(`${API_BASE_URL}/load-split-segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Lỗi tải phân đoạn');
      }

      const data = await response.json();
      const subs = await handleTranscribe(data.audioPath);
      
      if (subs) {
        setSubtitles(subs.map(s => ({ ...s, voice: s.voice || defaultVoice })));
        setVideoData(data);
        showToast(`Hoàn tất! Đã tải phân đoạn và tạo ${subs.length} phân đoạn thuyết minh.`);
      }
    } catch (error) {
      showToast(`Lỗi khởi tạo dự án: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'stretch' }}>
        
        {/* Left Column: Splitter Panel */}
        <div className="setup-card" style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', boxSizing: 'border-box' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>✂️ Cắt nhỏ video dài</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5', textAlign: 'left' }}>
            Chia nhỏ tệp video dài thành các phần đều nhau liên tục (sử dụng FFmpeg copy trực tiếp, không nén lại nên cực kỳ nhanh và giữ nguyên 100% chất lượng gốc).
          </p>

          {!isSplitting && splitSegments.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
              <div>
                <label className="upload-zone" htmlFor="video-split-file" style={{ display: 'block', padding: '24px', textAlign: 'center', cursor: 'pointer', border: '2px dashed var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                  <div className="upload-icon" style={{ fontSize: '28px', color: 'var(--text-muted)' }}>
                    📁
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: 500, margin: '8px 0 4px 0', color: 'var(--text-main)' }}>
                    {splitFile ? `Đã chọn: ${splitFile.name}` : 'Kéo thả hoặc chọn file video cần cắt nhỏ'}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Hỗ trợ MP4, MKV, AVI, v.v.</p>
                  <input 
                    type="file" 
                    id="video-split-file" 
                    style={{ display: 'none' }} 
                    accept="video/*"
                    onChange={handleSplitFileChange}
                  />
                </label>
              </div>

              {splitFile && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>Thời lượng mỗi phần:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input 
                        type="number" 
                        min="1" 
                        max="120"
                        value={segmentMinutes}
                        onChange={(e) => setSegmentMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ width: '70px', padding: '6px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '13px', textAlign: 'center', outline: 'none' }}
                      />
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>phút</span>
                    </div>
                  </div>

                  <button 
                    className="action-btn"
                    onClick={handleStartSplit}
                    style={{ width: '100%', padding: '12px', background: 'var(--accent)', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Bắt đầu cắt video
                  </button>
                </>
              )}
            </div>
          )}

          {isSplitting && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '12px', flex: 1 }}>
              <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
              <p style={{ fontSize: '13px', fontWeight: 600 }}>{splittingStatus}</p>
            </div>
          )}

          {splitSegments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>Kết quả: {splitSegments.length} phần</span>
                <button 
                  onClick={() => { setSplitFile(null); setSplitSegments([]); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', outline: 'none' }}
                >
                  Cắt video khác
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                {splitSegments.map((seg, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '60%', textAlign: 'left' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>{seg.fileName}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Thời lượng: {Math.floor(seg.duration / 60)}p {Math.round(seg.duration % 60)}s</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a 
                        href={seg.url} 
                        download={seg.fileName}
                        style={{ display: 'inline-block', padding: '6px 10px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}
                      >
                        Tải về
                      </a>
                      <button 
                        onClick={() => handleLoadSegmentAsProject(seg.filePath)}
                        style={{ padding: '6px 10px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                        disabled={!geminiKey}
                        title={!geminiKey ? "Nhập Gemini Key để lồng tiếng phân đoạn này" : "Tạo dự án lồng tiếng cho phân đoạn này"}
                      >
                        Lồng tiếng
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Import & Dubbing Creator */}
        <div className="setup-card" style={{ flex: '1 2 550px', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', boxSizing: 'border-box' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>🎙️ Tải video & Dịch lồng tiếng</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5', textAlign: 'left' }}>
            Tự động lắng nghe giọng nói tiếng Trung trong tệp video của bạn, dịch thuật sang tiếng Việt bằng Gemini AI và khởi tạo dự án lồng tiếng đồng bộ.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
            <label className="upload-zone" htmlFor="video-upload-file" style={{ display: 'block', padding: '40px', textAlign: 'center', cursor: 'pointer' }}>
              <div className="upload-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              </div>
              <p style={{fontWeight: 500, marginBottom: '6px', color: 'var(--text-main)'}}>Kéo thả hoặc nhấp để chọn file video</p>
              <p style={{fontSize: '12px', color: 'var(--text-muted)'}}>Hỗ trợ MP4, MKV, AVI, v.v.</p>
              <input 
                type="file" 
                id="video-upload-file" 
                style={{display: 'none'}} 
                accept="video/*"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>

      </div>
    </div>
  );
}
