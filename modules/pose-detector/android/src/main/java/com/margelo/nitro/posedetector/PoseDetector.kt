package com.margelo.nitro.posedetector

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.util.Log
import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageProxy
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.core.ImageProcessingOptions
import com.google.mediapipe.framework.image.BitmapImageBuilder
import org.json.JSONArray
import com.margelo.nitro.posedetector.HybridPoseDetectorSpec
import com.margelo.nitro.posedetector.Variant_NullType_ArrayBuffer
import com.margelo.nitro.camera.HybridFrameSpec
import com.margelo.nitro.camera.public.NativeFrame
import com.margelo.nitro.core.NullType
import com.margelo.nitro.core.ArrayBuffer

class PoseDetector : HybridPoseDetectorSpec() {
    private var poseLandmarker: PoseLandmarker? = null
    private var frameCount = 0

    init {
        Log.d("FitMate_AI", "MediaPipe Pose Landmarker (v5 Nitro) 초기화 시작...")
        val context = com.margelo.nitro.NitroModules.applicationContext
        if (context == null) {
            Log.e("FitMate_AI", "❌ ReactApplicationContext가 null입니다!")
        } else {
            val modelPath = "pose_landmarker_full.task"
            val landmarkerOptionsBuilder = PoseLandmarker.PoseLandmarkerOptions.builder()
                .setRunningMode(RunningMode.VIDEO)
                .setNumPoses(1)
                .setMinPoseDetectionConfidence(0.45f)
                .setMinPosePresenceConfidence(0.45f)
                .setMinTrackingConfidence(0.65f)

            try {
                val baseOptionsGPU = BaseOptions.builder()
                    .setModelAssetPath(modelPath)
                    .setDelegate(Delegate.GPU)
                    .build()

                poseLandmarker = PoseLandmarker.createFromOptions(context, landmarkerOptionsBuilder.setBaseOptions(baseOptionsGPU).build())
                Log.d("FitMate_AI", "✅ MediaPipe 엔진 탑재 완료 (GPU 모드)")
            } catch (e: Exception) {
                Log.w("FitMate_AI", "⚠️ GPU 초기화 실패. CPU 모드로 Fallback 재시도합니다: ${e.message}", e)
                try {
                    val baseOptionsCPU = BaseOptions.builder()
                        .setModelAssetPath(modelPath)
                        .setDelegate(Delegate.CPU)
                        .build()

                    poseLandmarker = PoseLandmarker.createFromOptions(context, landmarkerOptionsBuilder.setBaseOptions(baseOptionsCPU).build())
                    Log.d("FitMate_AI", "✅ MediaPipe 엔진 탑재 완료 (CPU Fallback 모드)")
                } catch (e2: Exception) {
                    Log.e("FitMate_AI", "❌ CPU 모드마저 초기화 실패: ${e2.message}", e2)
                }
            }
        }
    }

    @OptIn(ExperimentalGetImage::class)
    override fun detect(frame: HybridFrameSpec): Variant_NullType_ArrayBuffer {
        var bitmap: Bitmap? = null
        try {
            frameCount++
            val landmarker = poseLandmarker ?: run {
                if (frameCount % 60 == 0) {
                    Log.e("FitMate_AI", "❌ 엔진 미초기화로 추론 건너뜀")
                }
                return Variant_NullType_ArrayBuffer.create(NullType.NULL)
            }

            // frame을 NativeFrame으로 캐스팅하여 ImageProxy를 가져옴
            val nativeFrame = frame as? NativeFrame ?: run {
                if (frameCount % 60 == 0) {
                    Log.e("FitMate_AI", "❌ frame이 NativeFrame이 아님! (frame class: ${frame.javaClass.name})")
                }
                return Variant_NullType_ArrayBuffer.create(NullType.NULL)
            }
            val imageProxy = nativeFrame.image
            val androidImage = imageProxy.image ?: run {
                if (frameCount % 60 == 0) {
                    Log.e("FitMate_AI", "❌ ImageProxy 내부 android.media.Image가 null임")
                }
                return Variant_NullType_ArrayBuffer.create(NullType.NULL)
            }

            // CameraX 1.3.0+ API를 사용하여 YUV_420_888 ImageProxy를 RGBA_8888 Bitmap으로 직접 고성능 변환합니다.
            val originalBitmap = imageProxy.toBitmap()
            val rotationDegrees = imageProxy.imageInfo.rotationDegrees

            // 물리적으로 정방향(0도) 및 전면 카메라 좌우 반전(Mirroring)이 완전히 반영된 Bitmap을 생성
            bitmap = if (rotationDegrees != 0) {
                val matrix = Matrix().apply { 
                    postRotate(rotationDegrees.toFloat())
                    postScale(-1f, 1f) // 좌우 미러링 반사 적용
                }
                val rotated = Bitmap.createBitmap(originalBitmap, 0, 0, originalBitmap.width, originalBitmap.height, matrix, true)
                originalBitmap.recycle() // 회전되지 않은 원본 비트맵은 즉시 가비지 컬렉팅 대기 없이 제거
                rotated
            } else {
                originalBitmap
            }

            val mpImage = BitmapImageBuilder(bitmap).build()
            
            try {
                val timestampMs = imageProxy.imageInfo.timestamp / 1_000_000 // 나노초 -> 밀리초 변환

                // 이미지는 물리적으로 0도로 회전시켰으므로, MediaPipe에는 회전 각도 0도로 전달합니다.
                val imageProcessingOptions = ImageProcessingOptions.builder()
                    .setRotationDegrees(0)
                    .build()

                val result = landmarker.detectForVideo(mpImage, imageProcessingOptions, timestampMs)
                val landmarks = result.landmarks()

                if (landmarks.isNullOrEmpty()) {
                    // 매 프레임 감지 실패 로그는 너무 많으므로 60프레임(약 2초)당 한 번씩만 경고로 출력합니다.
                    if (frameCount % 60 == 0) {
                        Log.d("FitMate_AI", "⚠️ landmarks 감지 결과가 비어있음 (사람이 화면에 없거나 감지 불가 상태)")
                    }
                    return Variant_NullType_ArrayBuffer.create(NullType.NULL)
                }

                if (frameCount % 60 == 0) {
                    Log.d("FitMate_AI", "✅ landmarks 감지 완료 (감지된 사람 수: ${landmarks.size})")
                }
                val firstPerson = landmarks[0]

                // 33개 관절의 5가지 값 (x, y, z, visibility, presence) = 33 * 5 = 165 floats
                // 165 floats * 4 bytes = 660 bytes
                val arrayBuffer = ArrayBuffer.allocate(33 * 5 * 4)
                val byteBuffer = arrayBuffer.getBuffer(false)
                
                byteBuffer.rewind() // 초기화
                firstPerson.forEach {
                    byteBuffer.putFloat(it.x())
                    byteBuffer.putFloat(it.y())
                    byteBuffer.putFloat(it.z())
                    byteBuffer.putFloat(it.visibility().orElse(1.0f))
                    byteBuffer.putFloat(it.presence().orElse(1.0f))
                }
                byteBuffer.rewind() // 읽기 가능하도록 포지션 리셋 보장

                return Variant_NullType_ArrayBuffer.create(arrayBuffer)
            } finally {
                mpImage.close() // MediaPipe C++ 이미지 자원 릴리즈
            }
        } catch (e: Exception) {
            Log.e("FitMate_AI", "❌ 런타임 추론 에러: ${e.message}", e)
            return Variant_NullType_ArrayBuffer.create(NullType.NULL)
        } finally {
            bitmap?.recycle() // 변환 및 회전된 비트맵 자원을 즉시 네이티브 힙에서 회수
        }
    }
}
