const API_BASE = '/api/v1';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; email: string } }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    ),

  getMe: () =>
    request<{ user: { id: string; email: string; createdAt: string } }>(
      '/auth/me'
    ),

  getDomains: (page = 1, limit = 20) =>
    request<{
      domains: Array<{
        id: string;
        name: string;
        dkimSelector: string;
        isVerified: boolean;
        isActive: boolean;
        createdAt: string;
        apiKeyCount: number;
        emailCount: number;
      }>;
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(`/domains?page=${page}&limit=${limit}`),

  getDomain: (id: string) =>
    request<{
      domain: {
        id: string;
        name: string;
        dkimSelector: string;
        isVerified: boolean;
        isActive: boolean;
        createdAt: string;
        apiKeyCount: number;
        emailCount: number;
      };
      dnsRecords: {
        dkim: { type: string; host: string; value: string; ttl: number };
        spf: { type: string; host: string; value: string; ttl: number };
        dmarc: { type: string; host: string; value: string; ttl: number };
      };
    }>(`/domains/${id}`),

  createDomain: (name: string) =>
    request<{
      domain: { id: string; name: string };
      dnsRecords: Record<string, { type: string; host: string; value: string }>;
    }>('/domains', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  updateDomain: (id: string, data: { isActive?: boolean }) =>
    request<{ domain: { id: string; isActive: boolean } }>(`/domains/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteDomain: (id: string) =>
    request<void>(`/domains/${id}`, { method: 'DELETE' }),

  verifyDomain: (id: string) =>
    request<{ domain: { id: string; isVerified: boolean } }>(
      `/domains/${id}/verify`,
      { method: 'POST', body: '{}' }
    ),

  getApiKeys: (domainId: string) =>
    request<{
      keys: Array<{
        id: string;
        name: string;
        keyPrefix: string;
        isActive: boolean;
        lastUsedAt: string | null;
        createdAt: string;
      }>;
    }>(`/domains/${domainId}/keys`),

  createApiKey: (domainId: string, name: string) =>
    request<{
      key: {
        id: string;
        name: string;
        keyPrefix: string;
        rawKey: string;
      };
      warning: string;
    }>(`/domains/${domainId}/keys`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  updateApiKey: (id: string, data: { isActive?: boolean }) =>
    request<{ key: { id: string; isActive: boolean } }>(`/keys/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteApiKey: (id: string) =>
    request<void>(`/keys/${id}`, { method: 'DELETE' }),

  getLogs: (params: { page?: number; limit?: number; domainId?: string; status?: string } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.domainId) searchParams.set('domainId', params.domainId);
    if (params.status) searchParams.set('status', params.status);
    return request<{
      logs: Array<{
        id: string;
        domainId: string;
        domainName: string;
        messageId: string | null;
        fromEmail: string;
        toEmail: string;
        subject: string;
        status: string;
        error: string | null;
        sentAt: string;
      }>;
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(`/logs?${searchParams.toString()}`);
  },

  getLogStats: () =>
    request<{
      stats: {
        total: number;
        sent: number;
        failed: number;
        successRate: string;
        last24h: { sent: number; failed: number };
      };
    }>('/logs/stats'),
};
