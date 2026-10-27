const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
export const UPLOADS_BASE = import.meta.env.VITE_UPLOADS_BASE || `${API_BASE}/uploads`;

export const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
