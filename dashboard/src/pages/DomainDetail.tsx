import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Domain {
  id: string;
  name: string;
  dkimSelector: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  apiKeyCount: number;
  emailCount: number;
}

interface DnsRecord {
  type: string;
  host: string;
  value: string;
  ttl: number;
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

function DomainDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [domain, setDomain] = useState<Domain | null>(null);
  const [dnsRecords, setDnsRecords] = useState<Record<string, DnsRecord> | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    spf: { valid: boolean; found: string | null };
    dkim: { valid: boolean; found: string | null };
    dmarc: { valid: boolean; found: string | null };
  } | null>(null);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const [domainData, keysData] = await Promise.all([
        api.getDomain(id),
        api.getApiKeys(id),
      ]);
      setDomain(domainData.domain);
      setDnsRecords(domainData.dnsRecords);
      setApiKeys(keysData.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domain');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleCreateKey = async () => {
    if (!id || !newKeyName.trim()) return;
    setCreatingKey(true);
    setError('');

    try {
      const result = await api.createApiKey(id, newKeyName.trim());
      setNewKeyRaw(result.key.rawKey);
      setNewKeyName('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Delete this API key? This cannot be undone.')) return;

    try {
      await api.deleteApiKey(keyId);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete API key');
    }
  };

  const handleToggleKey = async (key: ApiKey) => {
    try {
      await api.updateApiKey(key.id, { isActive: !key.isActive });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleVerifyDns = async () => {
    if (!id) return;
    setVerifying(true);
    setError('');

    try {
      const result = await api.verifyDomain(id);
      setVerificationResult((result as any).verification);
      if ((result as any).domain) {
        setDomain(prev => prev ? { ...prev, isVerified: (result as any).domain.isVerified } : null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify DNS');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return <div className="empty-state">Loading...</div>;
  }

  if (!domain) {
    return <div className="empty-state">Domain not found</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/')}
            style={{ marginBottom: '0.5rem' }}
          >
            &larr; Back
          </button>
          <h1 className="page-title">{domain.name}</h1>
        </div>
        <span
          className={`badge ${domain.isActive ? 'badge-success' : 'badge-warning'}`}
        >
          {domain.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {error && (
        <div className="alert alert-warning">{error}</div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Emails Sent</div>
          <div className="stat-value">{domain.emailCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">API Keys</div>
          <div className="stat-value">{domain.apiKeyCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Created</div>
          <div className="stat-value" style={{ fontSize: '1rem' }}>
            {new Date(domain.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>DNS Records</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span className={`badge ${domain.isVerified ? 'badge-success' : 'badge-warning'}`}>
              {domain.isVerified ? 'Verified' : 'Unverified'}
            </span>
            <button
              className="btn btn-primary"
              onClick={handleVerifyDns}
              disabled={verifying}
            >
              {verifying ? 'Verifying...' : 'Verify DNS'}
            </button>
          </div>
        </div>
        <p style={{ color: 'var(--gray-500)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Add these DNS records to your domain to enable DKIM signing and improve deliverability.
        </p>

        {verificationResult && (
          <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--gray-800)', borderRadius: '0.5rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Verification Results:</div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <span className={`badge ${verificationResult.spf.valid ? 'badge-success' : 'badge-danger'}`}>
                SPF: {verificationResult.spf.valid ? '✓' : '✗'}
              </span>
              <span className={`badge ${verificationResult.dkim.valid ? 'badge-success' : 'badge-danger'}`}>
                DKIM: {verificationResult.dkim.valid ? '✓' : '✗'}
              </span>
              <span className={`badge ${verificationResult.dmarc.valid ? 'badge-success' : 'badge-danger'}`}>
                DMARC: {verificationResult.dmarc.valid ? '✓' : '✗'}
              </span>
            </div>
          </div>
        )}

        {dnsRecords && (
          <div>
            <div className="dns-record">
              <div className="dns-record-label">SPF Record</div>
              <div className="dns-record-host">
                Host: <code>{dnsRecords.spf.host}</code>
              </div>
              <div className="code-block">
                {dnsRecords.spf.value}
                <button
                  className="btn btn-secondary copy-btn"
                  onClick={() => copyToClipboard(dnsRecords.spf.value)}
                  style={{ float: 'right' }}
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="dns-record">
              <div className="dns-record-label">DKIM Record</div>
              <div className="dns-record-host">
                Host: <code>{dnsRecords.dkim.host}</code>
              </div>
              <div className="code-block">
                {dnsRecords.dkim.value}
                <button
                  className="btn btn-secondary copy-btn"
                  onClick={() => copyToClipboard(dnsRecords.dkim.value)}
                  style={{ float: 'right' }}
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="dns-record">
              <div className="dns-record-label">DMARC Record</div>
              <div className="dns-record-host">
                Host: <code>{dnsRecords.dmarc.host}</code>
              </div>
              <div className="code-block">
                {dnsRecords.dmarc.value}
                <button
                  className="btn btn-secondary copy-btn"
                  onClick={() => copyToClipboard(dnsRecords.dmarc.value)}
                  style={{ float: 'right' }}
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h2>API Keys</h2>
          <button
            className="btn btn-primary"
            onClick={() => setShowKeyModal(true)}
          >
            Create API Key
          </button>
        </div>

        {apiKeys.length === 0 ? (
          <div className="empty-state">
            <p>No API keys yet. Create one to start sending emails.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Key Prefix</th>
                <th>Status</th>
                <th>Last Used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td>
                    <code>{key.keyPrefix}...</code>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        key.isActive ? 'badge-success' : 'badge-warning'
                      }`}
                    >
                      {key.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      style={{ marginRight: '0.5rem' }}
                      onClick={() => handleToggleKey(key)}
                    >
                      {key.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteKey(key.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showKeyModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Create API Key</h2>
              <button
                className="modal-close"
                onClick={() => {
                  setShowKeyModal(false);
                  setNewKeyRaw(null);
                }}
              >
                &times;
              </button>
            </div>

            {newKeyRaw ? (
              <div>
                <div className="alert alert-warning">
                  Save this API key now. It will not be shown again.
                </div>
                <div className="code-block" style={{ marginTop: '1rem' }}>
                  {newKeyRaw}
                </div>
                <div className="modal-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => copyToClipboard(newKeyRaw)}
                  >
                    Copy Key
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setShowKeyModal(false);
                      setNewKeyRaw(null);
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="label" htmlFor="key-name">
                    Key Name
                  </label>
                  <input
                    id="key-name"
                    type="text"
                    className="input"
                    placeholder="e.g., Production, Staging"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
                <div className="modal-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowKeyModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleCreateKey}
                    disabled={creatingKey || !newKeyName.trim()}
                  >
                    {creatingKey ? 'Creating...' : 'Create Key'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DomainDetail;
