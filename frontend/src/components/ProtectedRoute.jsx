import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { fetchMe } from '../store/slices/authSlice';

function ProtectedRoute({ roles, children }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const { user, hydrated } = useSelector((s) => s.auth);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (token && !user && !hydrated) dispatch(fetchMe());
  }, [token, user, hydrated, dispatch]);

  if (token && !hydrated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  return children;
}

export default ProtectedRoute;
