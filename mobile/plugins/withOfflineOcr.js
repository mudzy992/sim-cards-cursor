const fs = require('node:fs');
const path = require('node:path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withMainApplication,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');

const MLKIT_META_NAME = 'com.google.mlkit.vision.DEPENDENCIES';
const MLKIT_META_VALUE = 'barcode_ui,ocr';
const BUNDLED_OCR_DEPENDENCY = "implementation 'com.google.mlkit:text-recognition:16.0.1'";

function buildOfflineOcrModuleKt(androidPackage) {
  return `package ${androidPackage}.ocr

import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File

@ReactModule(name = OfflineOcrModule.NAME)
class OfflineOcrModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  override fun getConstants(): Map<String, Any> =
    mapOf(
      "isSupported" to true,
      "engine" to "mlkit-bundled-16.0.1"
    )

  @ReactMethod
  fun extractTextFromImage(uriString: String, promise: Promise) {
    try {
      val trimmed = uriString.trim()
      if (trimmed.isEmpty()) {
        promise.reject("OCR_EMPTY_URI", "Image URI is empty.")
        return
      }

      val uri = if (trimmed.startsWith("content://")) {
        Uri.parse(trimmed)
      } else {
        val rawPath = if (trimmed.startsWith("file://")) {
          Uri.parse(trimmed).path ?: trimmed.removePrefix("file://")
        } else {
          trimmed
        }
        val file = File(rawPath)
        if (!file.exists()) {
          promise.reject("OCR_FILE_NOT_FOUND", "File not found: $rawPath")
          return
        }
        Uri.fromFile(file)
      }

      val inputImage = InputImage.fromFilePath(reactApplicationContext, uri)
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

      recognizer.process(inputImage)
        .addOnSuccessListener { visionText ->
          val result = Arguments.createArray()
          val blocks = visionText.textBlocks
          if (blocks.isNotEmpty()) {
            for (block in blocks) {
              if (block.text.isNotBlank()) {
                result.pushString(block.text)
              }
            }
          } else if (visionText.text.isNotBlank()) {
            result.pushString(visionText.text)
          }
          promise.resolve(result)
        }
        .addOnFailureListener { error ->
          promise.reject(
            "OCR_FAILED",
            error.message ?: error.javaClass.simpleName,
            error
          )
        }
        .addOnCompleteListener {
          try {
            recognizer.close()
          } catch (_: Exception) {
          }
        }
    } catch (error: Throwable) {
      promise.reject(
        "OCR_ERROR",
        "\${error.javaClass.simpleName}: \${error.message ?: "Unknown OCR error"}",
        error
      )
    }
  }

  companion object {
    const val NAME = "OfflineOcr"
  }
}
`;
}

function buildOfflineOcrPackageKt(androidPackage) {
  return `package ${androidPackage}.ocr

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class OfflineOcrPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return if (name == OfflineOcrModule.NAME) {
      OfflineOcrModule(reactContext)
    } else {
      null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      mapOf(
        OfflineOcrModule.NAME to ReactModuleInfo(
          OfflineOcrModule.NAME,
          OfflineOcrModule::class.java.name,
          false,
          false,
          false,
          false
        )
      )
    }
  }
}
`;
}

function buildProguardRules(androidPackage) {
  return `
# Offline ML Kit OCR (${androidPackage}.ocr + bundled text-recognition)
-keep class ${androidPackage}.ocr.** { *; }
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**
-keep class com.google.android.gms.vision.** { *; }
`;
}

function withOfflineOcr(config) {
  const androidPackage = config.android?.package || 'ba.epbih.simtracker';

  config = withAndroidManifest(config, (cfg) => {
    AndroidConfig.Manifest.ensureToolsAvailable(cfg.modResults);
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      app,
      MLKIT_META_NAME,
      MLKIT_META_VALUE,
    );
    const metaItem = (app['meta-data'] || []).find(
      (item) => item?.$?.['android:name'] === MLKIT_META_NAME,
    );
    if (metaItem?.$) {
      metaItem.$['tools:replace'] = 'android:value';
    }
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (!contents.includes('com.google.mlkit:text-recognition:')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    ${BUNDLED_OCR_DEPENDENCY}`,
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });

  config = withMainApplication(config, (cfg) => {
    let contents = cfg.modResults.contents;
    const importLine = `import ${androidPackage}.ocr.OfflineOcrPackage`;

    if (!contents.includes(importLine)) {
      contents = contents.replace(
        'import com.facebook.react.PackageList',
        `import com.facebook.react.PackageList\n${importLine}`,
      );
    }

    if (!contents.includes('OfflineOcrPackage()')) {
      contents = contents.replace(
        /(PackageList\(this\)\.packages\.apply\s*\{)/,
        `$1\n          add(OfflineOcrPackage())`,
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkgRoot = cfg.modRequest.platformProjectRoot;
      const ocrDir = path.join(
        pkgRoot,
        'app',
        'src',
        'main',
        'java',
        ...androidPackage.split('.'),
        'ocr',
      );
      fs.mkdirSync(ocrDir, { recursive: true });
      fs.writeFileSync(
        path.join(ocrDir, 'OfflineOcrModule.kt'),
        buildOfflineOcrModuleKt(androidPackage),
        'utf8',
      );
      fs.writeFileSync(
        path.join(ocrDir, 'OfflineOcrPackage.kt'),
        buildOfflineOcrPackageKt(androidPackage),
        'utf8',
      );

      const proguardPath = path.join(pkgRoot, 'app', 'proguard-rules.pro');
      if (fs.existsSync(proguardPath)) {
        const existing = fs.readFileSync(proguardPath, 'utf8');
        if (!existing.includes(`${androidPackage}.ocr.**`)) {
          fs.writeFileSync(
            proguardPath,
            `${existing}\n${buildProguardRules(androidPackage)}`,
            'utf8',
          );
        }
      }
      return cfg;
    },
  ]);

  return config;
}

module.exports = withOfflineOcr;
