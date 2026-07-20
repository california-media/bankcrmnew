import { useEffect } from 'react';
import { NotificationOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchActiveNotices } from '../store/slices/noticesSlice';

function NoticeBanner() {
  const dispatch = useDispatch();
  const { items, status, fetched } = useSelector((s) => s.notices);

  useEffect(() => {
    if (!fetched && status === 'idle') {
      dispatch(fetchActiveNotices());
    }
  }, [dispatch, fetched, status]);

  if (!items.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
      {items.map((n) => (
        <div
          key={n._id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '12px 16px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #f3e8ff 0%, #ede9fe 100%)',
            border: '1px solid #d8b4fe',
            borderLeft: '4px solid #7C3AED',
          }}
        >
          <NotificationOutlined style={{ color: '#7C3AED', fontSize: 16, marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#4c1d95', marginBottom: n.message ? 3 : 0 }}>
              {n.title}
            </div>
            {n.message && (
              <div style={{ fontSize: 13, color: '#6d28d9', lineHeight: 1.5 }}>
                {n.message}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default NoticeBanner;
