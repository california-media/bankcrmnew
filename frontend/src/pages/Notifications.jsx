import { useState, useMemo } from 'react';
import { Typography, Tabs, Button, Badge, Tag, Empty } from 'antd';
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

const TYPE_LABELS = {
  lead_created:            'New Lead',
  status_changed:          'Status',
  lead_assigned:           'Assigned',
  employee_status_updated: 'Employee Status',
  note_added:              'Note',
  commission_payable:      'Commission',
};

export default function Notifications() {
  const navigate  = useNavigate();
  const { user }  = useSelector((s) => s.auth);
  const { notifications, unreadCount, markRead, markAllRead, connected } = useNotificationsContext();
  const [tab, setTab] = useState('all');

  const filtered = useMemo(() => {
    if (tab === 'unread') return notifications.filter((n) => !n.isRead);
    return notifications;
  }, [notifications, tab]);

  const handleRow = (n) => {
    if (!n.isRead) markRead([String(n._id)]);
    if (n.lead) navigate(`/${user.role}/leads/${n.lead}`);
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Typography.Title level={3} style={{ margin: 0 }}>Notifications</Typography.Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#22c55e' : '#94a3b8' }} />
              <span style={{ fontSize: 12, color: connected ? '#16a34a' : '#94a3b8' }}>{connected ? 'Live' : 'Offline'}</span>
            </div>
          </div>
          <Typography.Text type="secondary">Live activity across your leads</Typography.Text>
        </div>
        <Button size="small" disabled={unreadCount === 0} onClick={markAllRead}>
          Mark all read
        </Button>
      </div>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        style={{ marginBottom: 0 }}
        items={[
          { key: 'all',    label: `All (${notifications.length})` },
          { key: 'unread', label: <span>Unread {unreadCount > 0 && <Badge count={unreadCount} size="small" style={{ marginLeft: 4 }} />}</span> },
        ]}
      />

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', marginTop: 16 }}>
        {filtered.length === 0 && <Empty description="No notifications" style={{ padding: '40px 0' }} />}
        {filtered.map((n, idx) => (
          <div
            key={n._id}
            onClick={() => handleRow(n)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              padding: '14px 20px',
              borderBottom: idx < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
              background: n.isRead ? 'transparent' : '#f8faff',
              cursor: n.lead ? 'pointer' : 'default',
            }}
            onMouseEnter={e => { if (n.lead) e.currentTarget.style.background = '#f1f5f9'; }}
            onMouseLeave={e => e.currentTarget.style.background = n.isRead ? 'transparent' : '#f8faff'}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: `${TYPE_COLORS[n.type] || '#4f46e5'}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: TYPE_COLORS[n.type] || '#4f46e5', fontSize: 16,
            }}>
              {TYPE_ICONS[n.type] || <BellOutlined />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontWeight: n.isRead ? 500 : 700, fontSize: 14, color: '#0f172a' }}>{n.title}</span>
                <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 6px', margin: 0 }}>
                  {TYPE_LABELS[n.type] || n.type}
                </Tag>
              </div>
              <div style={{ fontSize: 13, color: '#475569', marginBottom: 3 }}>{n.body}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{dayjs(n.createdAt).fromNow()}</div>
            </div>

            {!n.isRead && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', marginTop: 6, flexShrink: 0 }} />}
          </div>
        ))}
      </div>
    </>
  );
}
