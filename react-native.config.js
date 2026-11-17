// Autolinking (React Native CLI e Expo): onde estão as partes nativas do isoform.
module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath: 'import com.isoform.IsoformPackage;',
        packageInstance: 'new IsoformPackage()',
      },
      ios: {},
    },
  },
};
