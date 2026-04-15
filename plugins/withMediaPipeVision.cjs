const {
  createRunOncePlugin,
  withAppBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');
const pkg = require('../package.json');

// build.gradle에 MediaPipe 의존성 및 aaptOptions(noCompress) 추가
const withAndroidAppGradle = (config) => {
  return withAppBuildGradle(config, async (config) => {
    let contents = config.modResults.contents;

    // MediaPipe Tasks Vision 의존성 추가 (중복 방지)
    if (!contents.includes('com.google.mediapipe:tasks-vision')) {
      contents = contents.replace(
        /dependencies\s?\{/,
        `dependencies {\n    // MediaPipe Tasks Vision - Pose Landmarker\n    implementation 'com.google.mediapipe:tasks-vision:0.10.14'\n`
      );
    }

    // 모델 파일 압축 방지 설정 추가 (task, tflite 확장자)
    if (!contents.includes('noCompress "task"')) {
      contents = contents.replace(
        /android\s?\{/,
        `android {\n    aaptOptions {\n        noCompress "task"\n        noCompress "tflite"\n    }\n`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};

// 네이티브 파일 복사 및 MainApplication.kt 패치 (플러그인 등록, 모델 복사)
const withAndroidNativeFiles = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const targetDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'wsu',
        'fitmate'
      );
      const sourceDir = path.join(projectRoot, 'plugins', 'android');

      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true }); // 타깃 디렉토리 생성

      // PoseLandmarkerPlugin.kt 복사
      const pluginFileName = 'PoseLandmarkerPlugin.kt';
      const sourceFile = path.join(sourceDir, pluginFileName);
      const targetFile = path.join(targetDir, pluginFileName);
      if (fs.existsSync(sourceFile)) fs.copyFileSync(sourceFile, targetFile); // 플러그인 소스 복사

      // MainApplication.kt에 FrameProcessor 등록 및 applicationContext 주입
      const mainAppPath = path.join(targetDir, 'MainApplication.kt');
      if (fs.existsSync(mainAppPath)) {
        let mainAppContent = fs.readFileSync(mainAppPath, 'utf8');

        // 필요한 import가 없으면 추가
        if (
          !mainAppContent.includes(
            'import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry'
          )
        ) {
          mainAppContent = mainAppContent.replace(
            'package com.wsu.fitmate',
            'package com.wsu.fitmate\n\nimport com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry'
          );
        }

        // FrameProcessor 등록 코드 삽입 또는 context 인자 보정
        if (
          !mainAppContent.includes(
            'FrameProcessorPluginRegistry.addFrameProcessorPlugin("detectPose")'
          )
        ) {
          mainAppContent = mainAppContent.replace(
            'super.onCreate()',
            'super.onCreate()\n    // VisionCamera(v4) Frame Processor 등록\n    FrameProcessorPluginRegistry.addFrameProcessorPlugin("detectPose") { proxy, options -> PoseLandmarkerPlugin(this.applicationContext, proxy, options) }'
          );
        } else if (!mainAppContent.includes('this.applicationContext')) {
          mainAppContent = mainAppContent.replace(
            'PoseLandmarkerPlugin(proxy, options)',
            'PoseLandmarkerPlugin(this.applicationContext, proxy, options)'
          );
        }
        fs.writeFileSync(mainAppPath, mainAppContent); // 수정사항 저장
      }

      // MediaPipe 모델 파일을 Android assets로 복사 (full 모델 사용)
      const sourceModelPath = path.join(
        projectRoot,
        'assets',
        'models',
        'pose_landmarker_full.task'
      );
      const targetAssetDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets');

      if (!fs.existsSync(targetAssetDir)) fs.mkdirSync(targetAssetDir, { recursive: true }); // assets 디렉토리 생성

      const targetModelPath = path.join(targetAssetDir, 'pose_landmarker_full.task');
      if (fs.existsSync(sourceModelPath)) {
        fs.copyFileSync(sourceModelPath, targetModelPath); // 모델 파일 복사
        console.log('✅ [FitMate] MediaPipe Full 모델 파일 복사 완료');
      } else {
        console.warn(
          '⚠️ [FitMate] MediaPipe 모델 파일을 찾을 수 없습니다. (assets/models/pose_landmarker_full.task를 확인해주세요)'
        );
      }

      return config;
    },
  ]);
};

// ProGuard 규칙 추가: MediaPipe, protobuf, TFLite, Guava 등 난독화 예외 처리
const withAndroidProguard = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const proguardPath = path.join(projectRoot, 'android', 'app', 'proguard-rules.pro');

      // MediaPipe 및 관련 라이브러리 보호 규칙
      const mediaPipeRules = `
# --- MediaPipe Tasks Vision ProGuard Rules (Crash & Infinite Load Fix) ---
-keep class com.google.mediapipe.** { *; }
-keepclassmembers class com.google.mediapipe.** { *; }

# Protocol Buffers (Crucial for Model parsing)
-keep class com.google.protobuf.** { *; }
-keepclassmembers class com.google.protobuf.** { *; }
-keepclassmembers class * extends com.google.protobuf.GeneratedMessageLite { *; }

# Guava / Flogger / AutoValue (CRUCIAL FOR GPU DELEGATE)
-keep class com.google.common.** { *; }
-keep interface com.google.common.** { *; }
-keep class com.google.auto.value.** { *; }

# TensorFlow Lite (MediaPipe Internal Engine)
-keep class org.tensorflow.lite.** { *; }

# App Native Protection
-keep class com.wsu.fitmate.** { *; }
`;

      // proguard-rules.pro에 규칙이 없으면 추가하거나 새 파일로 생성
      if (fs.existsSync(proguardPath)) {
        let content = fs.readFileSync(proguardPath, 'utf8');
        if (!content.includes('com.google.auto.value')) {
          fs.writeFileSync(proguardPath, content + '\n' + mediaPipeRules);
        }
      } else {
        fs.writeFileSync(proguardPath, mediaPipeRules);
      }

      return config;
    },
  ]);
};

// 플러그인 조합: Gradle 패치, 네이티브 파일 복사, ProGuard 규칙 추가
const withMediaPipeVision = (config) => {
  config = withAndroidAppGradle(config);
  config = withAndroidNativeFiles(config);
  config = withAndroidProguard(config);
  return config;
};

module.exports = createRunOncePlugin(withMediaPipeVision, pkg.name, pkg.version); // 한 번만 실행되도록 등록
