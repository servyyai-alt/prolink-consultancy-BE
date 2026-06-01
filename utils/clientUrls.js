const getClientUrls = () => {
  const rawUrls = process.env.CLIENT_URLS || process.env.CLIENT_URL || '';
  return rawUrls
    .split(',')
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter(Boolean);
};

const getPrimaryClientUrl = () => getClientUrls()[0] || '';

module.exports = {
  getClientUrls,
  getPrimaryClientUrl,
};
