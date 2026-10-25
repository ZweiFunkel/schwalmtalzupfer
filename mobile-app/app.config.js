// Erweitert app.json nur für den Web-Export (npm run build:web): die Web-App wird unter /app ausgeliefert.
// Native Builds (EAS/Android) bleiben unverändert.
module.exports = ({ config }) => {
  if (!process.env.EXPO_WEB_BUILD) return config;
  return {
    ...config,
    experiments: { ...config.experiments, baseUrl: '/app' },
    web: { ...config.web, output: 'single', name: 'Schwalmtalzupfer', shortName: 'Zupfer' },
  };
};
