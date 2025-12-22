import dns from 'dns';
import { promisify } from 'util';

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
    const dkimHost = `${dkimSelector}._domainkey.${domain}`;
    const dkimRecords = await resolveTxt(dkimHost);
    const dkimRecord = dkimRecords.flat().join('');
    if (dkimRecord) {
      results.dkim.found = dkimRecord;
      // Verify the public key matches (normalize whitespace)
      const normalizedFound = dkimRecord.replace(/\s+/g, '');
      const normalizedExpected = results.dkim.expected.replace(/\s+/g, '');
      results.dkim.valid = normalizedFound.includes(expectedDkimPublicKey);
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
