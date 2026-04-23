import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

let accessToken: string | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;

  // Start or stop the proactive refresh cycle
  if (token) {
    startSilentRefresh();
  } else {
    stopSilentRefresh();
  }
}

export function getAccessToken() {
  return accessToken;
}

/** Silently refresh the access token using the stored refresh token */
async function silentRefresh() {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return;
    const { data } = await axios.post('/api/auth/refresh', { refreshToken });
    accessToken = data.accessToken;
    localStorage.setItem('refreshToken', data.refreshToken);
  } catch {
    // Refresh failed — token may be revoked/expired; let the 401 interceptor handle it on next request
  }
}

function startSilentRefresh() {
  stopSilentRefresh();
  // Refresh every 10 minutes (access token expires in 15m)
  refreshTimer = setInterval(silentRefresh, 10 * 60 * 1000);
}

function stopSilentRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        setAccessToken(data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        setAccessToken(null);
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
