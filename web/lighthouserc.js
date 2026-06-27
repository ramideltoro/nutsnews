module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run start -- -p 3000',
      startServerReadyPattern: 'Ready in|Local:|started server|listening',
      startServerReadyTimeout: 120000,
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/privacy',
        'http://localhost:3000/contact'
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --disable-dev-shm-usage'
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.60 }],
        'categories:accessibility': ['error', { minScore: 0.90 }],
        'categories:best-practices': ['warn', { minScore: 0.85 }],
        'categories:seo': ['error', { minScore: 0.90 }],

        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.15 }],
        'total-blocking-time': ['warn', { maxNumericValue: 600 }]
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
};
