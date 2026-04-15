package com.wsu.fitmate

import android.content.Context
import android.util.Log
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.core.ImageProcessingOptions
import com.google.mediapipe.framework.image.MediaImageBuilder

// VisionCamera 프레임을 받아 MediaPipe로 포즈를 추론해 JS로 반환하는 FrameProcessor 플러그인
class PoseLandmarkerPlugin(private val context: Context, proxy: VisionCameraProxy, options: Map<String, Any>?) : FrameProcessorPlugin() {
    
    private var poseLandmarker: PoseLandmarker? = null

    init {
        Log.d("PoseLandmarkerPlugin", "MediaPipe Pose Landmarker 초기화 시작...") // 초기화 시작 로그
        try {
            // 모델 경로와 Delegate 설정 (GPU 사용)
            val baseOptions = BaseOptions.builder()
                .setModelAssetPath("pose_landmarker_lite.task") // assets 내 .task 모델 파일 경로
                .setDelegate(Delegate.GPU)
                .build()

            // PoseLandmarker 옵션 설정 (비디오 모드, 신뢰도 등)
            val landmarkerOptions = PoseLandmarker.PoseLandmarkerOptions.builder()
                .setBaseOptions(baseOptions)
                .setRunningMode(RunningMode.VIDEO) // 연속 프레임용 비디오 모드
                .setNumPoses(1) // 최대 1명 추적
                .setMinPoseDetectionConfidence(0.3f) // 감도 완화(얼굴 가려짐 허용)
                .setMinPosePresenceConfidence(0.3f)
                .setMinTrackingConfidence(0.5f) // 트래킹 신뢰도는 보수적으로 유지
                .build()

            poseLandmarker = PoseLandmarker.createFromOptions(context, landmarkerOptions) // 엔진 생성
            Log.d("PoseLandmarkerPlugin", "✅ MediaPipe 엔진 탑재 완료") 
        } catch (e: Exception) {
            Log.e("PoseLandmarkerPlugin", "❌ MediaPipe 초기화 실패: ${e.message}") 
        }
    }

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
        try {
            val landmarker = poseLandmarker ?: return null // 엔진 미초기화 시 중단
            val image = frame.image ?: return null // 이미지 없으면 중단

            val mpImage = MediaImageBuilder(image).build() // MediaPipe 입력 이미지 생성
            val timestampMs = frame.timestamp / 1_000_000 // 나노초 -> 밀리초 변환

            val imageProcessingOptions = ImageProcessingOptions.builder()
                .setRotationDegrees(270) // 카메라 회전 보정
                .build()

            val result = landmarker.detectForVideo(mpImage, imageProcessingOptions, timestampMs) // 비디오 프레임 추론
            val landmarks = result.landmarks() // 추출된 랜드마크 목록
            
            if (landmarks.isNullOrEmpty()) {
                return null // 랜드마크 없으면 null 반환
            }

            val firstPerson = landmarks[0] // 첫 번째 사람(주 피사체) 선택
            // 각 랜드마크를 JS로 전달하기 쉬운 Map 구조로 변환
            val landmarkList = firstPerson.map {
                mapOf(
                    "x" to it.x().toDouble(),
                    "y" to it.y().toDouble(),
                    "z" to it.z().toDouble(),
                    "visibility" to it.visibility().orElse(1.0f).toDouble(),
                    "presence" to it.presence().orElse(1.0f).toDouble()
                )
            }

            // 랜드마크와 프레임 크기를 반환(프론트엔드에서 사용)
            return mapOf(
                "landmarks" to landmarkList,
                "frameWidth" to frame.width.toDouble(),
                "frameHeight" to frame.height.toDouble()
            )
        } catch (e: Exception) {
            Log.e("PoseLandmarkerPlugin", "⚠️ 추론 에러: ${e.message}")
            return null // 오류 시 안전하게 null 반환
        }
    }
}