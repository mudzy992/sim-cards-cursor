const fs = require('node:fs');
const path = require('node:path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');

const MLKIT_META_NAME = 'com.google.mlkit.vision.DEPENDENCIES';
const MLKIT_META_VALUE = 'ocr';
const BUNDLED_OCR_DEPENDENCY = "implementation 'com.google.mlkit:text-recognition:16.0.1'";
const EXCLUDE_THIN_MLKIT =
  "    exclude group: 'com.google.android.gms', module: 'play-services-mlkit-text-recognition'";

const PROGUARD_RULES = `
# Offline ML Kit OCR (expo-text-extractor + bundled text-recognition)
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**
-keep class com.google.android.gms.vision.** { *; }
-keep class expo.modules.textextractor.** { *; }
`;

function withOfflineOcr(config) {
  config = withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      app,
      MLKIT_META_NAME,
      MLKIT_META_VALUE,
    );
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (!contents.includes("play-services-mlkit-text-recognition")) {
      const excludeBlock = [
        '',
        'configurations.all {',
        EXCLUDE_THIN_MLKIT,
        '}',
        '',
      ].join('\n');
      contents = `${contents}\n${excludeBlock}`;
    }

    if (!contents.includes('com.google.mlkit:text-recognition:')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    ${BUNDLED_OCR_DEPENDENCY}`,
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const proguardPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro',
      );
      if (fs.existsSync(proguardPath)) {
        const existing = fs.readFileSync(proguardPath, 'utf8');
        if (!existing.includes('expo.modules.textextractor.**')) {
          fs.writeFileSync(proguardPath, `${existing}\n${PROGUARD_RULES}`, 'utf8');
        }
      }
      return cfg;
    },
  ]);

  return config;
}

module.exports = withOfflineOcr;
