import forge from 'node-forge';
import { config } from '../config.js';

export interface DkimKeyPair {
  privateKey: string;
  publicKey: string;
}

export function generateDkimKeyPair(): DkimKeyPair {
  const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048 });

  const privateKey = forge.pki.privateKeyToPem(keypair.privateKey);

  const publicKeyAsn1 = forge.pki.publicKeyToAsn1(keypair.publicKey);
  const publicKeyDer = forge.asn1.toDer(publicKeyAsn1).getBytes();
  const publicKeyBase64 = forge.util.encode64(publicKeyDer);

  return {
    privateKey,
    publicKey: publicKeyBase64,
  };
}

export function formatDkimPublicKeyForDns(publicKey: string): string {
  return `v=DKIM1; k=rsa; p=${publicKey}`;
}

export function getDnsRecords(domain: string, selector: string, publicKey: string) {
  // When using Brevo, show Brevo-specific DNS records
  if (config.brevo.apiKey) {
    const domainSlug = domain.replace(/\./g, '-');
    return {
      spf: {
        type: 'TXT',
        host: domain,
        value: 'v=spf1 include:brevo.com ~all',
        ttl: 3600,
      },
      dkim1: {
        type: 'CNAME',
        host: `brevo1._domainkey.${domain}`,
        value: `b1.${domainSlug}.dkim.brevo.com`,
        ttl: 300,
      },
      dkim2: {
        type: 'CNAME',
        host: `brevo2._domainkey.${domain}`,
        value: `b2.${domainSlug}.dkim.brevo.com`,
        ttl: 300,
      },
      dmarc: {
        type: 'TXT',
        host: `_dmarc.${domain}`,
        value: 'v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com',
        ttl: 3600,
      },
    };
  }

  // Default: self-hosted SMTP records
  return {
    spf: {
      type: 'TXT',
      host: domain,
      value: 'v=spf1 a mx ~all',
      ttl: 3600,
    },
    dkim: {
      type: 'TXT',
      host: `${selector}._domainkey.${domain}`,
      value: formatDkimPublicKeyForDns(publicKey),
      ttl: 3600,
    },
    dmarc: {
      type: 'TXT',
      host: `_dmarc.${domain}`,
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`,
      ttl: 3600,
    },
  };
}
