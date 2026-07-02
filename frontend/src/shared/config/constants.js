export const VOICES = [
  { id: 'vi-VN-HoaiMyNeural', name: 'Hoài My' },
  { id: 'vi-VN-NamMinhNeural', name: 'Nam Minh' },
  { id: 'capcut-cogaihoatngon', name: 'Cô Gái Hoạt Ngôn' },
  { id: 'capcut-nhongotngao', name: 'Nhỏ Ngọt Ngào' },
  { id: 'capcut-nuphothong', name: 'Nữ Phổ Thông' },
  { id: 'capcut-giongbe', name: 'Giọng Bé' },
  { id: 'capcut-vietmeo', name: 'Việt Méo' },
  { id: 'capcut-kennydaide', name: 'Kenny Đại Đế' }
];

export const PRESET_COLORS = [
  { name: 'Đen', value: '#000000' },
  { name: 'Xám', value: '#1e1e1e' },
  { name: 'Trắng', value: '#ffffff' },
  { name: 'Xanh dương', value: '#1d4ed8' },
  { name: 'Đỏ', value: '#b91c1c' }
];

export const TEXT_PRESETS = [
  { id: 'white-shadow', name: 'Trắng đổ bóng', color: '#ffffff', outlineColor: '#000000', outlineWidth: 2, bg: 'transparent', shadow: true },
  { id: 'yellow-shadow', name: 'Vàng đổ bóng', color: '#facc15', outlineColor: '#000000', outlineWidth: 2, bg: 'transparent', shadow: true },
  { id: 'black-white', name: 'Đen viền trắng', color: '#000000', outlineColor: '#ffffff', outlineWidth: 2, bg: 'transparent', shadow: false },
  { id: 'white-bg', name: 'Hộp nền đen', color: '#ffffff', outlineColor: 'transparent', outlineWidth: 0, bg: 'rgba(0, 0, 0, 0.75)', shadow: false },
  { id: 'yellow-bg', name: 'Hộp nền vàng', color: '#facc15', outlineColor: 'transparent', outlineWidth: 0, bg: 'rgba(0, 0, 0, 0.75)', shadow: false },
  { id: 'green-shadow', name: 'Xanh lá', color: '#22c55e', outlineColor: '#000000', outlineWidth: 2, bg: 'transparent', shadow: true },
  { id: 'purple-shadow', name: 'Tím', color: '#a855f7', outlineColor: '#000000', outlineWidth: 2, bg: 'transparent', shadow: true }
];

export const API_BASE_URL = 'http://localhost:3051/api';
