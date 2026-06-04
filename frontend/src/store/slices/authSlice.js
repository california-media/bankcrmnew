import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/client';

/**
 * @typedef {{
 *   id: string, name: string, email: string, phone: string,
 *   role: 'admin'|'agency'|'agent',
 *   referralCode?: string,
 *   banks?: Array<{ _id: string, name: string, code?: string }>
 * }} SafeUser
 */

/**
 * POST /auth/login
 * @param {{ email: string, password: string }} creds
 * @returns {Promise<SafeUser>}
 */
export const login = createAsyncThunk('auth/login', async (creds, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/login', creds);
    localStorage.setItem('token', data.token);
    return data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

/**
 * POST /auth/register-agent
 * @param {{ name: string, email: string, password: string, phone?: string, referralCode?: string }} payload
 * @returns {Promise<SafeUser>}
 */
export const registerAgent = createAsyncThunk('auth/registerAgent', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/register-agent', payload);
    localStorage.setItem('token', data.token);
    return data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Registration failed');
  }
});

export const registerAgency = createAsyncThunk('auth/registerAgency', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/register-agency', payload);
    return data; // { message: '...' } — no token, awaiting approval
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Registration failed');
  }
});

/**
 * POST /auth/set-password (completes invitation)
 * @param {{ token: string, password: string, name?: string, phone?: string }} payload
 * @returns {Promise<SafeUser>}
 */
export const setPassword = createAsyncThunk('auth/setPassword', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/set-password', payload);
    localStorage.setItem('token', data.token);
    return data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to set password');
  }
});

/**
 * PATCH /auth/profile — update name / phone / password.
 * @param {{ name?: string, phone?: string, currentPassword?: string, newPassword?: string }} payload
 * @returns {Promise<SafeUser>}
 */
export const updateProfile = createAsyncThunk('auth/updateProfile', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.patch('/auth/profile', payload);
    return data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Update failed');
  }
});

/**
 * GET /auth/me — rehydrate the current user from a stored token.
 * @returns {Promise<SafeUser>}
 */
export const fetchMe = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/auth/me');
    return data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Session expired');
  }
});

const initialState = {
  user: null,
  status: 'idle',
  error: null,
  hydrated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      localStorage.removeItem('token');
      state.user = null;
      state.error = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMe.pending, (state) => { state.status = 'loading'; })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = 'idle';
        state.hydrated = true;
      })
      .addCase(fetchMe.rejected, (state) => {
        state.user = null;
        state.status = 'idle';
        state.hydrated = true;
      });

    builder
      .addCase(updateProfile.fulfilled, (state, action) => {
        if (state.user) {
          state.user = { ...state.user, name: action.payload.name, phone: action.payload.phone };
        }
      });

    builder
      .addCase(registerAgency.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(registerAgency.fulfilled, (state) => { state.status = 'idle'; })
      .addCase(registerAgency.rejected, (state, action) => { state.status = 'idle'; state.error = action.payload; });

    [login, registerAgent, setPassword].forEach((thunk) => {
      builder
        .addCase(thunk.pending, (state) => { state.status = 'loading'; state.error = null; })
        .addCase(thunk.fulfilled, (state, action) => {
          state.user = action.payload;
          state.status = 'idle';
          state.hydrated = true;
        })
        .addCase(thunk.rejected, (state, action) => {
          state.status = 'idle';
          state.error = action.payload;
        });
    });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
