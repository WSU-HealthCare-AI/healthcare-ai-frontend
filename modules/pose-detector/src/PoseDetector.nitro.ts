import { type HybridObject } from 'react-native-nitro-modules'
import { type Frame } from 'react-native-vision-camera'

export interface PoseDetector extends HybridObject<{ ios: 'swift', android: 'kotlin' }> {
  detect(frame: Frame): ArrayBuffer | null
}
