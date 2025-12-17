import { useState, useEffect } from 'react';
import { api } from '../api';

interface Log {
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
}

interface Stats {
  total: number;
  sent: number;
  failed: number;
  successRate: string;
  last24h: { sent: number; failed: number };
}

function Logs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: { page: number; limit: number; status?: string } = {
        page,
        limit: 20,
      };
      if (statusFilter) {
        params.status = statusFilter;
      }
      const data = await api.getLogs(params);
      setLogs(data.logs);
      setTotalPages(data.pagination.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.getLogStats();
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, statusFilter]);

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Email Logs</h1>
      </div>

      {error && (
        <div className="alert alert-warning">{error}</div>
      )}

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Emails</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Sent</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {stats.sent}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Failed</div>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>
              {stats.failed}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Success Rate</div>
            <div className="stat-value">{stats.successRate}%</div>
          </div>
        </div>
      )}

      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`btn ${statusFilter === '' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setStatusFilter('');
                setPage(1);
              }}
            >
              All
            </button>
            <button
              className={`btn ${statusFilter === 'sent' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setStatusFilter('sent');
                setPage(1);
              }}
            >
              Sent
            </button>
            <button
              className={`btn ${statusFilter === 'failed' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setStatusFilter('failed');
                setPage(1);
              }}
            >
              Failed
            </button>
          </div>
          <button className="btn btn-secondary" onClick={fetchLogs}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <p>No emails logged yet.</p>
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Domain</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Subject</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(log.sentAt).toLocaleString()}
                    </td>
                    <td>{log.domainName}</td>
                    <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.fromEmail}
                    </td>
                    <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.toEmail}
                    </td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.subject}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          log.status === 'sent' ? 'badge-success' : 'badge-danger'
                        }`}
                        title={log.error || undefined}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-secondary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn btn-secondary"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Logs;
