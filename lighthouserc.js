module.exports = {
  ci: {
    collect: {
      startServerCommand: 'cd frontend && npm run preview',
      url: ['http://localhost:4173/'],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --disable-gpu',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.7 }],
        'categories:accessibility': ['error', { minScore: 0.7 }],
        'categories:best-practices': ['error', { minScore: 0.7 }],
        'categories:seo': ['error', { minScore: 0.7 }],
      },
    },
    upload: {
      // Upload report to a temporary public URL provided by Google for viewing
      target: 'temporary-public-storage',
    },
  },
};
