const {
  createRunOncePlugin,
  withAppBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');
const pkg = require('../package.json');

const withAndroidAppGradle = (config) => {
  return withAppBuildGradle(config, async (config) => {
    // build.gradle의 dependencies에 MediaPipe Tasks Vision 의존성 추가 (중복 방지)
    if (!config.modResults.contents.includes('com.google.mediapipe:tasks-vision')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s?\{/,
        `dependencies {\n    // MediaPipe Tasks Vision - Pose Landmarker\n    implementation 'com.google.mediapipe:tasks-vision:0.10.14'\n`
      );
    }
    return config;
  });
};

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

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true }); // 타깃 디렉토리 생성
      }

      // 1) Kotlin 플러그인 파일 복사 (PoseLandmarkerPlugin.kt)
      const pluginFileName = 'PoseLandmarkerPlugin.kt';
      const sourceFile = path.join(sourceDir, pluginFileName);
      const targetFile = path.join(targetDir, pluginFileName);

      if (fs.existsSync(sourceFile)) {
        fs.copyFileSync(sourceFile, targetFile); // 플러그인 소스 복사
      }

      // 2) MainApplication.kt 수정: FrameProcessor 등록 및 applicationContext 주입 (중복 체크)
      const mainAppPath = path.join(targetDir, 'MainApplication.kt');
      if (fs.existsSync(mainAppPath)) {
        let mainAppContent = fs.readFileSync(mainAppPath, 'utf8');

        if (
          !mainAppContent.includes(
            'import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry'
          )
        ) {
          // 필요한 import가 없으면 추가
          mainAppContent = mainAppContent.replace(
            'package com.wsu.fitmate',
            'package com.wsu.fitmate\n\nimport com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry'
          );
        }

        if (
          !mainAppContent.includes(
            'FrameProcessorPluginRegistry.addFrameProcessorPlugin("detectPose")'
          )
        ) {
          // FrameProcessor 등록 코드 삽입
          mainAppContent = mainAppContent.replace(
            'super.onCreate()',
            'super.onCreate()\n    // VisionCamera(v4) Frame Processor 등록\n    FrameProcessorPluginRegistry.addFrameProcessorPlugin("detectPose") { proxy, options -> PoseLandmarkerPlugin(this.applicationContext, proxy, options) }'
          );
        } else if (!mainAppContent.includes('this.applicationContext')) {
          // 이미 등록되어 있으나 context 인자가 없으면 수정
          mainAppContent = mainAppContent.replace(
            'PoseLandmarkerPlugin(proxy, options)',
            'PoseLandmarkerPlugin(this.applicationContext, proxy, options)'
          );
        }
        fs.writeFileSync(mainAppPath, mainAppContent); // 변경사항 저장
      }

      // 3) MediaPipe 모델 파일(.task)을 Android assets로 복사
      const sourceModelPath = path.join(
        projectRoot,
        'assets',
        'models',
        'pose_landmarker_lite.task'
      );
      const targetAssetDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets');

      if (!fs.existsSync(targetAssetDir)) {
        fs.mkdirSync(targetAssetDir, { recursive: true }); // assets 디렉토리 생성
      }

      const targetModelPath = path.join(targetAssetDir, 'pose_landmarker_lite.task');
      if (fs.existsSync(sourceModelPath)) {
        fs.copyFileSync(sourceModelPath, targetModelPath); // 모델 복사
        console.log('✅ [FitMate] MediaPipe 모델 파일 복사 완료');
      } else {
        console.warn(
          '⚠️ [FitMate] MediaPipe 모델 파일을 찾을 수 없습니다. (assets/models/pose_landmarker_lite.task)'
        );
      }

      return config;
    },
  ]);
};

const withMediaPipeVision = (config) => {
  // Gradle 패치 + 네이티브 파일 복사 적용
  config = withAndroidAppGradle(config);
  config = withAndroidNativeFiles(config);
  return config;
};

module.exports = createRunOncePlugin(withMediaPipeVision, pkg.name, pkg.version); // 플러그인 등록(한 번만 실행)
