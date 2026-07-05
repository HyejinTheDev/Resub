import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import VideoTab from './VideoTab';
import TextTab from './TextTab';
import AudioTab from './AudioTab';
import MaskTab from './MaskTab';
import ExportTab from './ExportTab';

export default function InspectorPanel() {
  const { inspectorTab, setInspectorTab } = useProjectStore();

  return (
    <section className="right-panel" style={{ width: '100%', height: '100%' }}>
      <div className="inspector-tabs">
        <button 
          className={`inspector-tab ${inspectorTab === 'video' ? 'active' : ''}`}
          onClick={() => setInspectorTab('video')}
        >
          Video
        </button>
        <button 
          className={`inspector-tab ${inspectorTab === 'text' ? 'active' : ''}`}
          onClick={() => setInspectorTab('text')}
        >
          Văn bản
        </button>
        <button 
          className={`inspector-tab ${inspectorTab === 'mask' ? 'active' : ''}`}
          onClick={() => setInspectorTab('mask')}
        >
          Làm mờ
        </button>
        <button 
          className={`inspector-tab ${inspectorTab === 'audio' ? 'active' : ''}`}
          onClick={() => setInspectorTab('audio')}
        >
          Âm thanh
        </button>
        <button 
          className={`inspector-tab ${inspectorTab === 'export' ? 'active' : ''}`}
          onClick={() => setInspectorTab('export')}
        >
          Xuất video
        </button>
      </div>

      <div className="inspector-content">
        {inspectorTab === 'video' && <VideoTab />}
        {inspectorTab === 'text' && <TextTab />}
        {inspectorTab === 'audio' && <AudioTab />}
        {inspectorTab === 'mask' && <MaskTab />}
        {inspectorTab === 'export' && <ExportTab />}
      </div>
    </section>
  );
}
