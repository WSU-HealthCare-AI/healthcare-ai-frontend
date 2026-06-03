const { withInfoPlist, withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

/**
 * Expo CLI가 react-native-vision-camera 패키지의 내부 소스를
 * Node.js 환경에서 구동하다 SyntaxError(Unexpected token 'typeof')를 내는 현상을
 * 차단하기 위해 제작된 무결점 로컬 가상 플러그인
 */
const withVisionCamera = (config, props = {}) => {
  const cameraPermissionText =
    props.cameraPermissionText || 'AI 실시간 자세 분석을 위해 카메라 접근 권한이 필요합니다.';

  // iOS Info.plist 권한 주입
  config = withInfoPlist(config, (config) => {
    config.modResults.NSCameraUsageDescription = cameraPermissionText;
    return config;
  });

  // Android AndroidManifest.xml 권한 주입
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest;

    if (!mainApplication['uses-permission']) {
      mainApplication['uses-permission'] = [];
    }

    const hasCameraPermission = mainApplication['uses-permission'].some(
      (p) => p.$['android:name'] === 'android.permission.CAMERA'
    );

    if (!hasCameraPermission) {
      mainApplication['uses-permission'].push({
        $: { 'android:name': 'android.permission.CAMERA' },
      });
    }

    return config;
  });

  return config;
};

module.exports = createRunOncePlugin(withVisionCamera, 'react-native-vision-camera', '1.0.0');
