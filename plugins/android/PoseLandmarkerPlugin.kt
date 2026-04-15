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
import org.json.JSONArray

// VisionCamera 프레임을 받아 MediaPipe로 포즈 추론 후 JSON 문자열로 반환하는 플러그인
class PoseLandmarkerPlugin(private val context: Context, proxy: VisionCameraProxy, options: Map<String, Any>?) : FrameProcessorPlugin() {
    
    private var poseLandmarker: PoseLandmarker? = null

    init {
        Log.d("FitMate_AI", "MediaPipe Pose Landmarker 초기화 시작...") // 초기화 시작 로그
        val modelPath = "pose_landmarker_full.task" // 사용할 모델 파일 경로
        val landmarkerOptionsBuilder = PoseLandmarker.PoseLandmarkerOptions.builder()
            .setRunningMode(RunningMode.VIDEO) // 비디오(연속 프레임) 모드 설정
            .setNumPoses(1) // 최대 인식 인원 수
            .setMinPoseDetectionConfidence(0.3f) // 감도 완화
            .setMinPosePresenceConfidence(0.35f)
            .setMinTrackingConfidence(0.5f)       
            
        try {
            val baseOptionsGPU = BaseOptions.builder()
                .setModelAssetPath(modelPath) // 모델을 assets에서 로드
                .setDelegate(Delegate.GPU) // GPU delegate 우선 시도
                .build()
            
            // GPU 옵션으로 엔진 생성 시도
            poseLandmarker = PoseLandmarker.createFromOptions(context, landmarkerOptionsBuilder.setBaseOptions(baseOptionsGPU).build()) 
            Log.d("FitMate_AI", "✅ MediaPipe 엔진 탑재 완료 (GPU 모드)") // GPU 성공 로그
        } catch (e: Exception) {
            Log.w("FitMate_AI", "⚠️ GPU 초기화 실패. CPU 모드로 Fallback 재시도합니다: ${e.message}") // GPU 실패 시 경고
            try {
                val baseOptionsCPU = BaseOptions.builder()
                    .setModelAssetPath(modelPath)
                    .setDelegate(Delegate.CPU) // CPU delegate로 대체
                    .build()
                
                // CPU 옵션으로 재시도
                poseLandmarker = PoseLandmarker.createFromOptions(context, landmarkerOptionsBuilder.setBaseOptions(baseOptionsCPU).build()) 
                Log.d("FitMate_AI", "✅ MediaPipe 엔진 탑재 완료 (CPU Fallback 모드)") // CPU 성공 로그
            } catch (e2: Exception) {
                Log.e("FitMate_AI", "❌ CPU 모드마저 초기화 실패: ${e2.message}") // 최종 실패 로그
            }
        }
    }

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
        try {
            val landmarker = poseLandmarker ?: run {
                Log.e("FitMate_AI", "⚠️ 엔진 미초기화로 추론 건너뜀")
                return null // 엔진 미초기화 시 중단
            }
            val image = frame.image ?: run {
                Log.e("FitMate_AI", "⚠️ 프레임 이미지가 비어있음")
                return null // 이미지 없으면 중단
            }

            val mpImage = MediaImageBuilder(image).build() // MediaPipe 입력 이미지 생성
            val timestampMs = frame.timestamp / 1_000_000 // 나노초 -> 밀리초 변환

            val rotation = (arguments?.get("rotation") as? Double)?.toInt() ?: 270 // 호출 인자에서 회전값 사용(기본 270)

            val imageProcessingOptions = ImageProcessingOptions.builder()
                .setRotationDegrees(rotation) // 회전 보정 적용
                .build()

            val result = landmarker.detectForVideo(mpImage, imageProcessingOptions, timestampMs) // 비디오 프레임 추론
            val landmarks = result.landmarks() // 추출된 랜드마크 목록
            
            if (landmarks.isNullOrEmpty()) {
                return null // 랜드마크가 없으면 null 반환
            }

            val firstPerson = landmarks[0] // 첫 번째 사람(주 피사체) 선택

            // 결과를 JSON 배열로 변환: [[x,y,z,visibility,presence], ...]
            val rootArray = JSONArray()
            firstPerson.forEach {
                val pointArray = JSONArray()
                pointArray.put(it.x().toDouble())
                pointArray.put(it.y().toDouble())
                pointArray.put(it.z().toDouble())
                pointArray.put(it.visibility().orElse(1.0f).toDouble())
                pointArray.put(it.presence().orElse(1.0f).toDouble())
                rootArray.put(pointArray)
            }

            return rootArray.toString() // JS 쪽에서 파싱할 수 있는 문자열 반환
        } catch (e: Exception) {
            Log.e("FitMate_AI", "⚠️ 런타임 추론 에러: ${e.message}") // 예외 로깅
            return null // 오류 시 안전하게 null 반환
        }
    }
}