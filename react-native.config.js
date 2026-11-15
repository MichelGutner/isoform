// Autolinking (React Native CLI e Expo): onde estão as partes nativas do omnistyle.
module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath: 'import com.omnistyle.OmnistylePackage;',
        packageInstance: 'new OmnistylePackage()',
      },
      ios: {},
    },
  },
};
