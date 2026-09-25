import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid({
  title: 'Telehealth',
  description: 'Technical documentation for the telehealth prototype',
  base: process.env.DOCS_BASE || '/',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Overview', link: '/' },
      { text: 'Architecture', link: '/architecture/c4-context' },
      { text: 'Modules', link: '/modules/product-website' },
      { text: 'API', link: '/api/' },
    ],
    sidebar: [
      {
        text: 'Technical Overview',
        items: [{ text: 'Context & Features', link: '/' }],
      },
      {
        text: 'High-level Architecture',
        items: [
          { text: 'C4 L1 — Context', link: '/architecture/c4-context' },
          { text: 'C4 L2 — Container', link: '/architecture/c4-container' },
          { text: 'C4 L3 — Component', link: '/architecture/c4-component' },
          { text: 'Deployment', link: '/architecture/deployment' },
          { text: 'Authentication & Authorization', link: '/architecture/auth' },
          { text: 'Notifications & Real-time', link: '/architecture/realtime' },
          { text: 'Clinical Access', link: '/architecture/clinical-access' },
          { text: 'API Conventions', link: '/architecture/api-conventions' },
          { text: 'Data Model', link: '/architecture/data-model' },
        ],
      },
      {
        text: 'Detailed Architecture',
        items: [
          { text: 'Product Website', link: '/modules/product-website' },
          { text: 'Patient', link: '/modules/patient' },
          { text: 'Doctor', link: '/modules/doctor' },
          { text: 'Admin', link: '/modules/admin' },
        ],
      },
      {
        text: 'API Documentation',
        items: [{ text: 'Reference', link: '/api/' }],
      },
    ],
  },
});
