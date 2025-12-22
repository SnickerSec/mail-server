import dns from 'dns';
import { promisify } from 'util';
import { config } from '../config.js';

// Use Google's public DNS for more reliable lookups
const resolver = new dns.Resolver();
resolver.setServers(['8.8.8.8', '8.8.4.4']);

const resolveTxt = promisify(resolver.resolveTxt.bind(resolver));

export interface DnsVerificationResult {
  spf: { valid: boolean; found: string | null; expected: string };
  dkim: { valid: boolean; found: string | null; expected: string };
  dmarc: { valid: boolean; found: string | null; expected: string };
  allValid: boolean;
}

/**
 * Verifies DNS records for a domain
 */
export async function verifyDomainDns(
  domain: string,
  dkimSelector: string,
  expectedDkimPublicKey: string
): Promise<DnsVerificationResult> {
  const results: DnsVerificationResult = {
    spf: { valid: false, found: null, expected: 'v=spf1' },
    dkim: {
      valid: false,
      found: null,
      expected: `v=DKIM1; k=rsa; p=${expectedDkimPublicKey}`,
    },
    dmarc: { valid: false, found: null, expected: 'v=DMARC1' },
    allValid: false,
  };

  // Check SPF record
  try {
    const spfRecords = await resolveTxt(domain);
    const spfRecord = spfRecords.flat().find((r) => r.startsWith('v=spf1'));
    if (spfRecord) {
      results.spf.found = spfRecord;
      results.spf.valid = true;
    }
  } catch (err) {
    // Record not found or DNS error
  }

  // Check DKIM record
  try {
    // When using Brevo, check for Brevo's CNAME-based DKIM records
    if (config.brevo.apiKey) {
      const domainSlug = domain.replace(/\./g, '-');
      let brevoValid = true;

      for (const num of ['1', '2']) {
        try {
          const resolveCname = promisify(resolver.resolveCname.bind(resolver));
          const cname = await resolveCname(`brevo${num}._domainkey.${domain}`);
          const expected = `b${num}.${domainSlug}.dkim.brevo.com`;
          if (!cname.some(c => c.replace(/\.$/, '') === expected)) {
            brevoValid = false;
          }
        } catch {
          brevoValid = false;
        }
      }

      results.dkim.valid = brevoValid;
      results.dkim.found = brevoValid ? 'Brevo DKIM CNAMEs configured' : null;
      results.dkim.expected = `brevo1._domainkey → b1.${domainSlug}.dkim.brevo.com`;
    } else {
      // Self-hosted: check TXT record
      const dkimHost = `${dkimSelector}._domainkey.${domain}`;
      const dkimRecords = await resolveTxt(dkimHost);
      const dkimRecord = dkimRecords.flat().join('');
      if (dkimRecord) {
        results.dkim.found = dkimRecord;
        const normalizedFound = dkimRecord.replace(/\s+/g, '');
        results.dkim.valid = normalizedFound.includes(expectedDkimPublicKey);
      }
    }
  } catch (err) {
    // Record not found or DNS error
  }

  // Check DMARC record
  try {
    const dmarcHost = `_dmarc.${domain}`;
    const dmarcRecords = await resolveTxt(dmarcHost);
    const dmarcRecord = dmarcRecords.flat().find((r) => r.startsWith('v=DMARC1'));
    if (dmarcRecord) {
      results.dmarc.found = dmarcRecord;
      results.dmarc.valid = true;
    }
  } catch (err) {
    // Record not found or DNS error
  }

  results.allValid = results.spf.valid && results.dkim.valid && results.dmarc.valid;

  return results;
}

/**
 * Quick check if a domain has basic DNS records configured
 */
export async function quickDnsCheck(domain: string): Promise<boolean> {
  try {
    // Just check if we can resolve MX or A records for the domain
    const resolve = promisify(dns.resolve);
    await resolve(domain, 'MX').catch(() => resolve(domain, 'A'));
    return true;
  } catch {
    return false;
  }
}
