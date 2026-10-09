module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { reanimated: false, worklets: false }]],
    // Reanimated 4 uses this plugin. It must be last and included once.
    plugins: ['react-native-worklets/plugin'],
  };
};
