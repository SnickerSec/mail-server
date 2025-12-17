import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

interface Domain {
  id: string;
  name: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  apiKeyCount: number;
  emailCount: number;
}

function Domains() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchDomains = async () => {
    try {
      const data = await api.getDomains();
      setDomains(data.domains);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domains');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const handleCreateDomain = async () => {
    if (!newDomainName.trim()) return;
    setCreating(true);
    setError('');

    try {
      await api.createDomain(newDomainName.trim().toLowerCase());
      setShowModal(false);
      setNewDomainName('');
      fetchDomains();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create domain');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (domain: Domain) => {
    try {
      await api.updateDomain(domain.id, { isActive: !domain.isActive });
      fetchDomains();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update domain');
    }
  };

  const handleDelete = async (domain: Domain) => {
    if (!confirm(`Delete domain "${domain.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteDomain(domain.id);
      fetchDomains();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete domain');
    }
  };

  if (loading) {
    return <div className="empty-state">Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Domains</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          Add Domain
        </button>
      </div>

      {error && (
        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="card">
        {domains.length === 0 ? (
          <div className="empty-state">
            <p>No domains yet. Add your first domain to get started.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Domain</th>
                <th>Status</th>
                <th>API Keys</th>
                <th>Emails Sent</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <tr key={domain.id}>
                  <td>
                    <Link
                      to={`/domains/${domain.id}`}
                      style={{
                        color: 'var(--primary)',
                        textDecoration: 'none',
                        fontWeight: 500,
                      }}
                    >
                      {domain.name}
                    </Link>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        domain.isActive ? 'badge-success' : 'badge-warning'
                      }`}
                    >
                      {domain.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {!domain.isVerified && (
                      <span
                        className="badge badge-warning"
                        style={{ marginLeft: '0.5rem' }}
                      >
                        Unverified
                      </span>
                    )}
                  </td>
                  <td>{domain.apiKeyCount}</td>
                  <td>{domain.emailCount}</td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      style={{ marginRight: '0.5rem' }}
                      onClick={() => handleToggleActive(domain)}
                    >
                      {domain.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(domain)}
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

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Add Domain</h2>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="form-group">
              <label className="label" htmlFor="domain-name">
                Domain Name
              </label>
              <input
                id="domain-name"
                type="text"
                className="input"
                placeholder="example.com"
                value={newDomainName}
                onChange={(e) => setNewDomainName(e.target.value)}
              />
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
              After adding the domain, you'll need to configure DNS records for
              DKIM, SPF, and DMARC.
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateDomain}
                disabled={creating || !newDomainName.trim()}
              >
                {creating ? 'Creating...' : 'Add Domain'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Domains;
