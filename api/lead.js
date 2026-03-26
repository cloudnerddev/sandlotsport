export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const oid = process.env.SALESFORCE_OID;
  if (!oid) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const {
    first_name,
    last_name,
    email,
    company,
    phone,
    lead_type,
    source_page,
    turnstile_token,
  } = req.body;

  if (!turnstile_token) {
    return res.status(400).json({ error: 'CAPTCHA verification required' });
  }

  const turnstileRes = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.CLOUDFLARE_SECRET_KEY,
        response: turnstile_token,
      }),
    }
  );
  const turnstileData = await turnstileRes.json();
  if (!turnstileData.success) {
    return res.status(403).json({ error: 'CAPTCHA verification failed' });
  }

  if (!first_name || !last_name || !email || !company) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const descriptions = {
    homepage: 'Waitlist signup from Sandlot homepage',
    schools: 'School/district inquiry from Schools partner page',
    cities: 'City/municipality inquiry from Cities partner page',
    apartments: 'Property manager inquiry from Apartments partner page',
    manufacturers: 'Manufacturer partnership inquiry from Manufacturers page',
    investor: 'Investor inquiry from Investor page',
  };

  const params = new URLSearchParams({
    oid,
    first_name,
    last_name,
    email,
    company,
    phone: phone || '',
    lead_source: 'Sandlot Sports Website',
    description: [
      descriptions[source_page] || `Inquiry from ${source_page || 'unknown'} page`,
      lead_type ? `Type: ${lead_type}` : '',
    ].filter(Boolean).join('\n'),
    retURL: 'https://sandlotsport.vercel.app',
  });

  const sfResponse = await fetch(
    'https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }
  );

  if (sfResponse.ok) {
    return res.status(200).json({ success: true });
  } else {
    return res.status(502).json({ error: 'Failed to submit to Salesforce' });
  }
}
