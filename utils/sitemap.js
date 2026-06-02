const escapeXml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const normalizeBaseUrl = (baseUrl = '') => baseUrl.replace(/\/+$/, '');

const staticRoutes = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/about', changefreq: 'monthly', priority: '0.8' },
  { path: '/services', changefreq: 'weekly', priority: '0.9' },
  { path: '/jobs', changefreq: 'daily', priority: '0.9' },
  { path: '/blogs', changefreq: 'weekly', priority: '0.8' },
  { path: '/contact', changefreq: 'monthly', priority: '0.7' },
  { path: '/cv-writing', changefreq: 'monthly', priority: '0.8' },
  { path: '/campus-drive', changefreq: 'monthly', priority: '0.8' },
  { path: '/events', changefreq: 'monthly', priority: '0.7' },
  { path: '/catering', changefreq: 'monthly', priority: '0.7' },
  { path: '/testimonials', changefreq: 'monthly', priority: '0.6' },
  { path: '/brochures', changefreq: 'monthly', priority: '0.5' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
];

const toUrlNode = ({ loc, lastmod, changefreq = 'weekly', priority = '0.7' }) => {
  const lastmodTag = lastmod ? `<lastmod>${escapeXml(new Date(lastmod).toISOString())}</lastmod>` : '';
  return [
    '<url>',
    `<loc>${escapeXml(loc)}</loc>`,
    lastmodTag,
    `<changefreq>${changefreq}</changefreq>`,
    `<priority>${priority}</priority>`,
    '</url>',
  ].filter(Boolean).join('');
};

const buildSitemapXml = (entries = []) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(toUrlNode).join('\n')}\n</urlset>`;

const getSitemapEntries = async ({ baseUrl, Job, Blog, Service }) => {
  const siteUrl = normalizeBaseUrl(baseUrl);

  const [jobs, blogs, services] = await Promise.all([
    Job.find({ status: 'active', isDeleted: false }).select('slug updatedAt createdAt').lean(),
    Blog.find({ status: 'published' }).select('slug updatedAt publishedAt createdAt').lean(),
    Service.find({ isActive: true }).select('slug updatedAt createdAt').lean(),
  ]);

  return [
    ...staticRoutes.map((route) => ({ ...route, loc: `${siteUrl}${route.path}` })),
    ...services.map((service) => ({
      loc: `${siteUrl}/services/${service.slug}`,
      lastmod: service.updatedAt || service.createdAt,
      changefreq: 'monthly',
      priority: '0.8',
    })),
    ...jobs.map((job) => ({
      loc: `${siteUrl}/jobs/${job.slug}`,
      lastmod: job.updatedAt || job.createdAt,
      changefreq: 'daily',
      priority: '0.8',
    })),
    ...blogs.map((blog) => ({
      loc: `${siteUrl}/blogs/${blog.slug}`,
      lastmod: blog.updatedAt || blog.publishedAt || blog.createdAt,
      changefreq: 'weekly',
      priority: '0.7',
    })),
  ];
};

module.exports = {
  buildSitemapXml,
  getSitemapEntries,
};
