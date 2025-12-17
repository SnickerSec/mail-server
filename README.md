# Multi-Domain Mail Server

A production-ready transactional email server for Railway that supports multiple domains with DKIM signing, API key authentication, and a simple admin dashboard.

## Features

- Multi-domain support with automatic DKIM key generation
- Per-domain API key authentication
- Simple admin dashboard for domain/key management
- Email logging with statistics
- Rate limiting
- Docker deployment optimized for Railway

## Quick Start

### Local Development

1. **Clone and install dependencies:**
   ```bash
   npm install
   cd dashboard && npm install && cd ..
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Start PostgreSQL** (using Docker):
   ```bash
   docker run -d --name mail-postgres \
     -e POSTGRES_DB=mailserver \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgres \
     -p 5432:5432 \
     postgres:16
   ```

4. **Run database migrations:**
   ```bash
   npx prisma db push
   ```

5. **Start the server:**
   ```bash
   npm run dev
   ```

6. **Start the dashboard** (in another terminal):
   ```bash
   cd dashboard && npm run dev
   ```

The server will be running at `http://localhost:3000` and the dashboard at `http://localhost:5173`.

### Deploy to Railway

1. **Create a new project** in Railway

2. **Add PostgreSQL** from Railway's service catalog

3. **Deploy this repository:**
   - Connect your GitHub repository
   - Railway will automatically detect the Dockerfile

4. **Set environment variables** in Railway:
   ```
   DATABASE_URL=<automatically set by Railway PostgreSQL>
   JWT_SECRET=<generate a random 32+ character string>
   ENCRYPTION_KEY=<generate a random 32+ character string>
   ADMIN_EMAIL=your-admin@email.com
   ADMIN_PASSWORD=your-secure-password
   ```

5. **Deploy** - Railway will build and start your server

6. **Access the dashboard** at your Railway URL

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for JWT signing (32+ chars) | Yes |
| `ENCRYPTION_KEY` | Key for DKIM encryption (32+ chars) | Yes |
| `ADMIN_EMAIL` | Initial admin email | No (default: admin@localhost) |
| `ADMIN_PASSWORD` | Initial admin password | No (default: changeme) |
| `SMTP_HOST` | SMTP relay host (optional) | No |
| `SMTP_PORT` | SMTP relay port | No (default: 587) |
| `SMTP_USER` | SMTP relay username | No |
| `SMTP_PASS` | SMTP relay password | No |
| `PORT` | Server port | No (default: 3000) |
| `RATE_LIMIT_MAX` | Max requests per window | No (default: 100) |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | No (default: 60000) |

## API Usage

### Send an Email

```bash
curl -X POST https://your-server.railway.app/api/v1/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "noreply@yourdomain.com",
    "to": "recipient@example.com",
    "subject": "Hello!",
    "html": "<h1>Welcome</h1><p>This is a test email.</p>",
    "text": "Welcome! This is a test email."
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | string | Yes | Sender email (must match domain) |
| `to` | string or string[] | Yes | Recipient(s), max 50 |
| `subject` | string | Yes | Email subject |
| `html` | string | No* | HTML content |
| `text` | string | No* | Plain text content |
| `replyTo` | string | No | Reply-to address |

*Either `html` or `text` is required.

### Response

```json
{
  "success": true,
  "messageId": "<unique-message-id@yourdomain.com>"
}
```

## DNS Configuration

For each domain, add these DNS records:

### SPF Record
```
Type: TXT
Host: @
Value: v=spf1 a mx ~all
TTL: 3600
```

### DKIM Record
```
Type: TXT
Host: mail._domainkey
Value: v=DKIM1; k=rsa; p=<YOUR_PUBLIC_KEY>
TTL: 3600
```

The DKIM public key is shown in the dashboard after adding a domain.

### DMARC Record
```
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
TTL: 3600
```

## Using an SMTP Relay

For better deliverability, configure an SMTP relay (SendGrid, AWS SES, Mailgun, etc.):

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

When using a relay, you may need to:
1. Verify your domain with the relay provider
2. Update SPF records to include the relay's servers
3. The DKIM signing is still done by this server

## Admin Dashboard

Access the dashboard at your server URL. Features:
- Add/manage domains
- View DNS records for each domain
- Create/revoke API keys
- View email logs and statistics

## API Endpoints Reference

### Public (API Key Auth)
- `POST /api/v1/send` - Send an email

### Admin (JWT Auth)
- `POST /api/v1/auth/login` - Admin login
- `GET /api/v1/auth/me` - Get current user
- `GET /api/v1/domains` - List domains
- `POST /api/v1/domains` - Create domain
- `GET /api/v1/domains/:id` - Get domain details
- `PATCH /api/v1/domains/:id` - Update domain
- `DELETE /api/v1/domains/:id` - Delete domain
- `POST /api/v1/domains/:id/verify` - Mark domain verified
- `GET /api/v1/domains/:domainId/keys` - List API keys
- `POST /api/v1/domains/:domainId/keys` - Create API key
- `PATCH /api/v1/keys/:id` - Update API key
- `DELETE /api/v1/keys/:id` - Delete API key
- `GET /api/v1/logs` - Get email logs
- `GET /api/v1/logs/stats` - Get email statistics

## Security Notes

1. **API Keys** are hashed with bcrypt before storage
2. **DKIM private keys** are encrypted at rest with AES-256-GCM
3. **Rate limiting** is enabled by default (100 req/min per API key)
4. Change the default admin password after first login
5. Use HTTPS in production (Railway provides this automatically)

## License

MIT
