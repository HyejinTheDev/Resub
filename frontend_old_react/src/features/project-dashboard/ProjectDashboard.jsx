import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import VideoImportScreen from '../video-import/VideoImportScreen';

export default function ProjectDashboard({ onNewProjectClick }) {
  const {
    projects,
    loadProject,
    deleteProject,
    renameProject
  } = useProjectStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const handleStartRename = (e, project) => {
    e.stopPropagation();
    setRenamingId(project.id);
    setRenameValue(project.name);
  };

  const handleSaveRename = (e, id) => {
    e.stopPropagation();
    if (renameValue.trim()) {
      renameProject(id, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleKeyDownRename = (e, id) => {
    if (e.key === 'Enter') {
      handleSaveRename(e, id);
    } else if (e.key === 'Escape') {
      setRenamingId(null);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Vừa xong';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  };

  const getProjectDuration = (project) => {
    if (!project.subtitles || project.subtitles.length === 0) return '00:00';
    // Find max end time
    let maxSecs = 0;
    project.subtitles.forEach(sub => {
      const match = sub.endTime.match(/(\d+)m(\d+)s(\d+)ms/);
      if (match) {
        const secs = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 1000;
        if (secs > maxSecs) maxSecs = secs;
      }
    });
    
    const mins = Math.floor(maxSecs / 60).toString().padStart(2, '0');
    const secs = Math.floor(maxSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="project-dashboard-container" style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '40px 24px',
      color: 'var(--text-color)'
    }}>
      {/* Creation/Import panel at the top */}
      <div style={{ marginBottom: '40px' }}>
        <VideoImportScreen />
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', marginBottom: '32px' }} />
      {/* Title & Search row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            letterSpacing: '-0.5px',
            marginBottom: '4px'
          }}>Dự án của tôi</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Quản lý và tiếp tục biên tập các video lồng tiếng của bạn</p>
        </div>

        {/* Search */}
        <div className="search-bar-container" style={{ width: '320px', margin: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder="Tìm kiếm dự án..." 
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="project-search-input"
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          )}
        </div>
      </div>

      {/* Grid of Projects */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '24px'
      }}>


        {/* Existing Projects */}
        {filteredProjects.map((p) => (
          <div 
            key={p.id}
            onClick={() => loadProject(p.id)}
            className="project-card"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.3)';
              const btn = e.currentTarget.querySelector('.project-delete-btn');
              if (btn) btn.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
              const btn = e.currentTarget.querySelector('.project-delete-btn');
              if (btn) btn.style.opacity = '0';
            }}
          >
            {/* Video Thumbnail Hover Playback */}
            <div style={{
              width: '100%',
              aspectRatio: '16/10',
              background: '#000',
              position: 'relative',
              overflow: 'hidden',
              borderBottom: '1px solid var(--border-color)'
            }}>
              {p.videoData && p.videoData.videoUrl ? (
                <video 
                  src={p.videoData.videoUrl} 
                  muted 
                  playsInline 
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.play().catch(() => {});
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.5) 100%)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: 'var(--text-muted)'
                }}>
                  🎬 No video
                </div>
              )}

              {/* Hover Delete Button */}
              <button
                className="project-delete-btn"
                title="Xóa dự án"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Bạn có chắc chắn muốn xóa dự án "${p.name}" không?`)) {
                    deleteProject(p.id);
                  }
                }}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              >
                🗑️
              </button>

              {/* Duration badge */}
              <div style={{
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                background: 'rgba(0,0,0,0.75)',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                fontFamily: 'monospace'
              }}>
                {getProjectDuration(p)}
              </div>
            </div>

            {/* Info details */}
            <div style={{ padding: '12px' }}>
              {renamingId === p.id ? (
                <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }} onClick={e => e.stopPropagation()}>
                  <input 
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDownRename(e, p.id)}
                    style={{
                      flex: 1,
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--accent)',
                      color: '#fff',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '13px'
                    }}
                    autoFocus
                  />
                  <button 
                    onClick={(e) => handleSaveRename(e, p.id)}
                    style={{
                      background: 'var(--accent)',
                      color: '#000',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    Lưu
                  </button>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px'
                }}>
                  <span 
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '150px'
                    }}
                    title={p.name}
                  >
                    {p.name}
                  </span>
                  <button
                    onClick={(e) => handleStartRename(e, p)}
                    title="Đổi tên"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '2px'
                    }}
                  >
                    ✏️
                  </button>
                </div>
              )}
              
              <div style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>Cập nhật:</span>
                <span>{formatTimeAgo(p.updatedAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
