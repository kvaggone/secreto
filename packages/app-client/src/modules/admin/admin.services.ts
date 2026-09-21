import { apiClient } from '../shared/http/http-client';

export { fetchAdminSession, fetchAdminStats, fetchSuppressions, loginAdmin, logoutAdmin, removeSuppression };
export type { AdminStats, SuppressionsPage };

type DatabaseStatus = 'ok' | 'not-configured' | 'unavailable';

type AdminStats = {
  databaseStatus: DatabaseStatus;
  suppressedEmailsCount: number | null;
  notes: {
    totals: { today: number; last7Days: number; last30Days: number; allTime: number };
    last30Days: { deleteAfterReading: number; emailGated: number };
    daily: { date: string; count: number }[];
  } | null;
};

type SuppressionsPage = {
  items: { email: string; createdAt: string }[];
  total: number;
  page: number;
  pageSize: number;
};

async function loginAdmin({ email, password }: { email: string; password: string }) {
  return apiClient<{ email: string }>({ path: '/api/admin/login', method: 'POST', body: { email, password } });
}

async function logoutAdmin() {
  return apiClient<{ ok: boolean }>({ path: '/api/admin/logout', method: 'POST' });
}

async function fetchAdminSession() {
  return apiClient<{ email: string }>({ path: '/api/admin/session', method: 'GET' });
}

async function fetchAdminStats() {
  return apiClient<AdminStats>({ path: '/api/admin/stats', method: 'GET' });
}

async function fetchSuppressions({ search, page, pageSize }: { search: string; page: number; pageSize: number }) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(search ? { search } : {}) });

  return apiClient<SuppressionsPage>({ path: `/api/admin/suppressions?${query}`, method: 'GET' });
}

async function removeSuppression({ email }: { email: string }) {
  return apiClient<{ removed: boolean }>({ path: `/api/admin/suppressions/${encodeURIComponent(email)}`, method: 'DELETE' });
}
