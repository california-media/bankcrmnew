import {
  FilePdfOutlined, FileWordOutlined, FileExcelOutlined, FileImageOutlined, FilePptOutlined, FileZipOutlined, FileTextOutlined, FileOutlined,
} from '@ant-design/icons';

// Must match INQUIRY_REPLY_EXTS in backend upload.middleware
export const INQUIRY_REPLY_EXTS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.ppt', '.pptx', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.zip'];

export const formatBytes = (n = 0) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export const fileIcon = (name = '') => {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'pdf') return <FilePdfOutlined style={{ color: '#dc2626' }} />;
  if (['doc', 'docx'].includes(ext)) return <FileWordOutlined style={{ color: '#2563eb' }} />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileExcelOutlined style={{ color: '#16a34a' }} />;
  if (['ppt', 'pptx'].includes(ext)) return <FilePptOutlined style={{ color: '#ea580c' }} />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <FileImageOutlined style={{ color: '#7c3aed' }} />;
  if (ext === 'zip') return <FileZipOutlined style={{ color: '#a16207' }} />;
  if (ext === 'txt') return <FileTextOutlined style={{ color: '#475569' }} />;
  return <FileOutlined />;
};

