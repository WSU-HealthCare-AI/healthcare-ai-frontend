import { NitroModules } from 'react-native-nitro-modules'
import type { PoseDetector } from './PoseDetector.nitro'

export const poseDetector = NitroModules.createHybridObject<PoseDetector>('PoseDetector')
export * from './PoseDetector.nitro'
