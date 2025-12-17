import forge from 'node-forge';

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
  return {
    dkim: {
      type: 'TXT',
      host: `${selector}._domainkey.${domain}`,
      value: formatDkimPublicKeyForDns(publicKey),
      ttl: 3600,
    },
    spf: {
      type: 'TXT',
      host: domain,
      value: 'v=spf1 a mx ~all',
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
