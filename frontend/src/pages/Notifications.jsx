import { Empty } from 'antd';
import {
  BellOutlined, PlusCircleOutlined, CheckCircleOutlined,
  UserAddOutlined, SyncOutlined, MessageOutlined, DollarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useNotificationsContext } from '../contexts/NotificationsContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const TYPE_ICONS = {
  lead_created:            <PlusCircleOutlined />,
  status_changed:          <CheckCircleOutlined />,
  lead_assigned:           <UserAddOutlined />,
  employee_status_updated: <SyncOutlined />,
  note_added:              <MessageOutlined />,
  commission_payable:      <DollarOutlined />,
};

const TYPE_COLORS = {
  lead_created:            '#4f46e5',
  status_changed:          '#16a34a',
  lead_assigned:           '#2563eb',
  employee_status_updated: '#0891b2',
  note_added:              '#d97706',
  commission_payable:      '#16a34a',
};

const TITLE_REMAP = {
  'New Lead Submitted': 'New Lead',
  'Lead Approved':      'Application Approved',
  'Lead Disbursed':     'Application Disbursed',
  'Lead Rejected':      'Application Rejected',
};

const cleanBody = (body = '', type) => {
  if (type === 'note_added') {
    return body.replace(/\s*—\s*".*$/, '').trim();
  }
  if (type === 'status_changed') {
    return body.replace(/\s*moved to\s+\S+.*$/i, '').replace(/\s*—\s*$/, '').trim();
  }
  if (type === 'lead_created') {
    return body.replace(/\s+submitted\s+by\s+[\w\s]+$/i, '').replace(/\s+submitted$/i, '').trim();
  }
  return body.replace(/\s+by\s+[\w\s]+[:.]?\s*/gi, ' ').replace(/\s{2,}/g, ' ').trim();
};

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const { notifications, markRead, connected } = useNotificationsContext();

  const handleRow = (n) => {
    if (!n.isRead) markRead([String(n._id)]);
    if (n.lead) navigate(`/${user.role}/leads/${n.lead}`);
  };

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>

      {/* Live activity header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid #e2e8f0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
            background: '#4f46e5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 18,
          }}>
            <BellOutlined />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Live activity feed</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Updated in real time across all leads</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#22c55e' : '#94a3b8' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: connected ? '#16a34a' : '#94a3b8', letterSpacing: 0.5 }}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {notifications.length === 0 && <Empty description="No notifications" style={{ padding: '40px 0' }} />}

      {notifications.map((n, idx) => (
        <div
          key={n._id}
          onClick={() => handleRow(n)}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 20px',
            borderBottom: idx < notifications.length - 1 ? '1px solid #f1f5f9' : 'none',
            background: n.isRead ? 'transparent' : '#f8faff',
            cursor: n.lead ? 'pointer' : 'default',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => { if (n.lead) e.currentTarget.style.background = '#f1f5f9'; }}
          onMouseLeave={e => e.currentTarget.style.background = n.isRead ? 'transparent' : '#f8faff'}
        >
          {/* Round icon */}
          <div style={{
            width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
            background: `${TYPE_COLORS[n.type] || '#4f46e5'}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: TYPE_COLORS[n.type] || '#4f46e5', fontSize: 17,
            border: `1.5px solid ${TYPE_COLORS[n.type] || '#4f46e5'}30`,
          }}>
            {TYPE_ICONS[n.type] || <BellOutlined />}
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: n.isRead ? 500 : 700, fontSize: 14, color: '#0f172a', lineHeight: 1.3 }}>
              {TITLE_REMAP[n.title] || n.title}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cleanBody(n.body, n.type)}
            </div>
          </div>

          {/* Unread dot */}
          {!n.isRead && (
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
          )}

          {/* Time — far right */}
          <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, minWidth: 52, textAlign: 'right' }}>
            {dayjs(n.createdAt).fromNow()}
          </span>
        </div>
      ))}
    </div>
  );
}
