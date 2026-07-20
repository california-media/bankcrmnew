import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/client';

export const fetchActiveNotices = createAsyncThunk(
  'notices/fetchActive',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/notices/active');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load notices');
    }
  }
);

const noticesSlice = createSlice({
  name: 'notices',
  initialState: { items: [], status: 'idle', error: null, fetched: false },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchActiveNotices.pending,   (state) => { state.status = 'loading'; })
      .addCase(fetchActiveNotices.fulfilled, (state, action) => {
        state.items   = action.payload;
        state.status  = 'idle';
        state.fetched = true;
      })
      .addCase(fetchActiveNotices.rejected,  (state, action) => {
        state.status  = 'failed';
        state.error   = action.payload;
        state.fetched = true;
      });
  },
});

export default noticesSlice.reducer;
