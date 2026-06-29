// Convert "00m02s500ms" or "0:02.50" to seconds
export const parseTimeToSeconds = (timeStr) => {
  if (typeof timeStr === 'number') return timeStr;
  if (!timeStr) return 0;
  
  const match = timeStr.match(/(?:(\d+)m)?(?:(\d+)s)?(?:(\d+)ms)?/);
  if (match && (match[1] || match[2] || match[3])) {
    const mins = parseInt(match[1] || '0', 10);
    const secs = parseInt(match[2] || '0', 10);
    const ms = parseInt(match[3] || '0', 10);
    return mins * 60 + secs + ms / 1000;
  }

  const parts = timeStr.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secsParts = parts[1].split('.');
    const secs = parseInt(secsParts[0], 10);
    const ms = parseInt(secsParts[1] || '0', 10) * (secsParts[1]?.length === 2 ? 10 : 1);
    return mins * 60 + secs + ms / 1000;
  }

  return parseFloat(timeStr) || 0;
};

// Convert seconds to "00m00s000ms"
export const formatSecondsToCustomTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${mins.toString().padStart(2, '0')}m${secs.toString().padStart(2, '0')}s${ms.toString().padStart(3, '0')}ms`;
};

// Format seconds to MM:SS
export const formatTime = (secs) => {
  const minutes = Math.floor(secs / 60);
  const seconds = Math.floor(secs % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const hexToRgba = (hex, opacity) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
