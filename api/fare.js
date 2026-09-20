export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { trainNo, from, to } = req.query;

  if (!trainNo || !/^\d{4,5}$/.test(trainNo)) {
    return res.status(400).json({ ok: false, error: 'Valid trainNo required' });
  }
  if (!from || !to) {
    return res.status(400).json({ ok: false, error: 'from and to station codes required' });
  }

  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    return res.status(500).json({ ok: false, error: 'Server missing RAPIDAPI_KEY env variable' });
  }

  try {
    const url = `https://irctc1.p.rapidapi.com/api/v2/getFare?trainNo=${encodeURIComponent(trainNo)}&fromStationCode=${encodeURIComponent(from)}&toStationCode=${encodeURIComponent(to)}`;
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': 'irctc1.p.rapidapi.com'
      }
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!upstream.ok) {
      return res.status(upstream.status).json({ ok: false, error: data?.message || 'Upstream API error', status: upstream.status });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'Failed to reach train data provider', detail: String(err) });
  }
}
