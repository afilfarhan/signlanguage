/**
 * Non-Manual Markers (NMM) Feature Extraction
 * Extracts facial expressions, head pose, and other non-manual features
 * from MediaPipe Holistic landmarks for grammatical disambiguation in ASL
 */

import type { MediaPipeHolisticResults } from "./loadExternals";

export interface NMMFeatures {
  // Eyebrow features
  leftBrowRaise: number;      // 0-1: inner brow raise (yes/no questions)
  rightBrowRaise: number;
  browFurrow: number;         // 0-1: brow furrow (wh-questions)
  browInnerDistance: number;  // Distance between inner brows
  
  // Eye features
  leftEyeOpenness: number;    // 0-1: eye openness
  rightEyeOpenness: number;
  eyeGazeLeftRight: number;   // -1 to 1: gaze direction
  eyeGazeUpDown: number;      // -1 to 1: gaze direction
  
  // Mouth features
  mouthOpen: number;          // 0-1: mouth openness
  mouthWidth: number;         // Normalized mouth width
  mouthHeight: number;        // Normalized mouth height
  mouthCornerRaise: number;   // -1 to 1: smile/frown
  mouthPucker: number;        // 0-1: pucker (for "O" shapes)
  mouthTension: number;       // 0-1: lip tension
  
  // Head pose
  headPitch: number;          // -90 to 90: up/down tilt
  headYaw: number;            // -90 to 90: left/right turn
  headRoll: number;           // -90 to 90: side tilt
  
  // Grammatical markers (derived)
  isQuestion: boolean;        // yes/no question (brow raise)
  isWhQuestion: boolean;      // wh-question (brow furrow)
  isNegation: boolean;        // negation (head shake)
  isAffirmation: boolean;     // affirmation (head nod)
  isTopic: boolean;           // topic marking (brow raise + hold)
}

// MediaPipe Face Mesh landmark indices (468 landmarks)
export const FACE_LANDMARKS = {
  // Eyes
  leftEye: {
    top: 159, bottom: 145, left: 33, right: 133,
    upperLid: [159, 158, 157, 173], lowerLid: [145, 144, 153, 154],
    iris: 468,
  },
  rightEye: {
    top: 386, bottom: 374, left: 362, right: 263,
    upperLid: [386, 385, 387, 263], lowerLid: [374, 373, 390, 380],
    iris: 473,
  },
  
  // Eyebrows
  leftEyebrow: {
    inner: 70, middle: 63, outer: 105,
    upper: [70, 63, 105, 66, 107], lower: [55, 65, 52, 53, 46],
  },
  rightEyebrow: {
    inner: 300, middle: 293, outer: 334,
    upper: [300, 293, 334, 296, 336], lower: [285, 295, 282, 283, 276],
  },
  
  // Mouth
  mouth: {
    left: 61, right: 291, top: 13, bottom: 14,
    upperLip: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
    lowerLip: [146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
    upperInner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
    lowerInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
    corners: { left: 61, right: 291 },
  },
  
  // Face oval / reference points
  nose: { tip: 1, bridge: 6, left: 129, right: 358 },
  chin: 152,
  forehead: 10,
  leftCheek: 234,
  rightCheek: 454,
} as const;

// Pose landmarks (33 landmarks)
export const POSE_LANDMARKS = {
  nose: 0,
  leftEye: 2, rightEye: 5,
  leftEar: 7, rightEar: 8,
  leftShoulder: 11, rightShoulder: 12,
  leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16,
} as const;

/** Calculate Euclidean distance between two 2D points */
function dist2d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Get landmark safely with fallback */
function getLandmark(landmarks: { x: number; y: number; z: number }[] | undefined, index: number): { x: number; y: number; z: number } | null {
  if (!landmarks || index >= landmarks.length) return null;
  const lm = landmarks[index];
  if (!lm) return null;
  return { x: lm.x, y: lm.y, z: lm.z ?? 0 };
}

/** Calculate eye openness (0-1) */
function calculateEyeOpenness(landmarks: { x: number; y: number; z: number }[], eyeIndices: { top: number; bottom: number; left: number; right: number; upperLid: readonly number[]; lowerLid: readonly number[]; iris: number }): number {
  const top = getLandmark(landmarks, eyeIndices.top);
  const bottom = getLandmark(landmarks, eyeIndices.bottom);
  const left = getLandmark(landmarks, eyeIndices.left);
  const right = getLandmark(landmarks, eyeIndices.right);
  
  if (!top || !bottom || !left || !right) return 0.5;
  
  const vertical = dist2d(top, bottom);
  const horizontal = dist2d(left, right);
  return horizontal > 0 ? clamp(vertical / horizontal, 0, 1) : 0.5;
}

/** Calculate eyebrow raise (0-1, normalized to eye openness) */
function calculateBrowRaise(
  landmarks: { x: number; y: number; z: number }[],
  browIndices: { inner: number; middle: number; outer: number; upper: readonly number[]; lower: readonly number[] },
  eyeIndices: { top: number; bottom: number; left: number; right: number; upperLid: readonly number[]; lowerLid: readonly number[]; iris: number }
): number {
  const browInner = getLandmark(landmarks, browIndices.inner);
  const browMiddle = getLandmark(landmarks, browIndices.middle);
  const eyeTop = getLandmark(landmarks, eyeIndices.top);
  const eyeBottom = getLandmark(landmarks, eyeIndices.bottom);
  
  if (!browInner || !browMiddle || !eyeTop || !eyeBottom) return 0;
  
  // Distance from eyebrow to eye top, normalized by eye height
  const eyeHeight = dist2d(eyeTop, eyeBottom);
  if (eyeHeight < 1e-4) return 0;
  
  const browToEye = Math.min(
    dist2d(browInner, eyeTop),
    dist2d(browMiddle, eyeTop)
  );
  
  // Normalize: 0 = brow on eye, 1 = brow high
  return clamp(1 - browToEye / (eyeHeight * 2), 0, 1);
}

/** Calculate brow furrow (0-1) - distance between inner brows */
function calculateBrowFurrow(
  landmarks: { x: number; y: number; z: number }[],
  leftBrow: { inner: number; middle: number; outer: number; upper: readonly number[]; lower: readonly number[] },
  rightBrow: { inner: number; middle: number; outer: number; upper: readonly number[]; lower: readonly number[] }
): number {
  const leftInner = getLandmark(landmarks, leftBrow.inner);
  const rightInner = getLandmark(landmarks, rightBrow.inner);
  
  if (!leftInner || !rightInner) return 0;
  
  const distance = dist2d(leftInner, rightInner);
  // Normalize: smaller distance = more furrow
  return clamp(1 - distance / 0.15, 0, 1);
}

/** Calculate mouth openness (0-1) */
function calculateMouthOpen(landmarks: { x: number; y: number; z: number }[]): number {
  const top = getLandmark(landmarks, FACE_LANDMARKS.mouth.top);
  const bottom = getLandmark(landmarks, FACE_LANDMARKS.mouth.bottom);
  const left = getLandmark(landmarks, FACE_LANDMARKS.mouth.left);
  const right = getLandmark(landmarks, FACE_LANDMARKS.mouth.right);
  
  if (!top || !bottom || !left || !right) return 0;
  
  const vertical = dist2d(top, bottom);
  const horizontal = dist2d(left, right);
  return horizontal > 0 ? clamp(vertical / horizontal, 0, 1) : 0;
}

/** Calculate mouth width normalized to face width */
function calculateMouthWidth(landmarks: { x: number; y: number; z: number }[]): number {
  const left = getLandmark(landmarks, FACE_LANDMARKS.mouth.left);
  const right = getLandmark(landmarks, FACE_LANDMARKS.mouth.right);
  const leftCheek = getLandmark(landmarks, FACE_LANDMARKS.leftCheek);
  const rightCheek = getLandmark(landmarks, FACE_LANDMARKS.rightCheek);
  
  if (!left || !right || !leftCheek || !rightCheek) return 0;
  
  const mouthWidth = dist2d(left, right);
  const faceWidth = dist2d(leftCheek, rightCheek);
  return faceWidth > 0 ? clamp(mouthWidth / faceWidth, 0, 1) : 0;
}

/** Calculate mouth corner raise (-1 to 1) */
function calculateMouthCornerRaise(landmarks: { x: number; y: number; z: number }[]): number {
  const leftCorner = getLandmark(landmarks, FACE_LANDMARKS.mouth.corners.left);
  const rightCorner = getLandmark(landmarks, FACE_LANDMARKS.mouth.corners.right);
  const leftInner = getLandmark(landmarks, FACE_LANDMARKS.mouth.upperInner[0]);
  const rightInner = getLandmark(landmarks, FACE_LANDMARKS.mouth.upperInner[5]);
  
  if (!leftCorner || !rightCorner || !leftInner || !rightInner) return 0;
  
  const leftRaise = leftInner.y - leftCorner.y;
  const rightRaise = rightInner.y - rightCorner.y;
  return clamp((leftRaise + rightRaise) / 2, -1, 1);
}

/** Calculate mouth pucker (0-1) */
function calculateMouthPucker(landmarks: { x: number; y: number; z: number }[]): number {
  const width = calculateMouthWidth(landmarks);
  const open = calculateMouthOpen(landmarks);
  // Pucker = narrow mouth + slightly open
  return clamp((1 - width) * open * 2, 0, 1);
}

/** Calculate mouth tension (0-1) */
function calculateMouthTension(landmarks: { x: number; y: number; z: number }[]): number {
  const upperInner = getLandmark(landmarks, FACE_LANDMARKS.mouth.upperInner[0]);
  const lowerInner = getLandmark(landmarks, FACE_LANDMARKS.mouth.lowerInner[0]);
  
  if (!upperInner || !lowerInner) return 0;
  
  // Vertical compression of inner lips
  const compression = Math.abs(upperInner.y - lowerInner.y);
  return clamp(compression * 10, 0, 1);
}

/** Calculate head pose from pose landmarks */
function calculateHeadPose(poseLandmarks: { x: number; y: number; z: number; visibility?: number }[] | undefined): { pitch: number; yaw: number; roll: number } {
  if (!poseLandmarks) return { pitch: 0, yaw: 0, roll: 0 };
  
  const nose = getLandmark(poseLandmarks, POSE_LANDMARKS.nose);
  const leftEye = getLandmark(poseLandmarks, POSE_LANDMARKS.leftEye);
  const rightEye = getLandmark(poseLandmarks, POSE_LANDMARKS.rightEye);
  
  if (!nose || !leftEye || !rightEye) return { pitch: 0, yaw: 0, roll: 0 };
  
  // Yaw: nose position relative to eye midpoint
  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const yaw = (nose.x - eyeMidX) * 180; // Approximate degrees
  
  // Pitch: nose vertical relative to eyes
  const pitch = (nose.y - eyeMidY) * 180;
  
  // Roll: eye line angle
  const eyeAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180 / Math.PI;
  const roll = eyeAngle;
  
  return { pitch: clamp(pitch, -90, 90), yaw: clamp(yaw, -90, 90), roll: clamp(roll, -90, 90) };
}

/** Clamp value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Extract all NMM features from Holistic results */
export function extractNMMFeatures(results: MediaPipeHolisticResults): NMMFeatures {
  const face = results.faceLandmarks;
  const pose = results.poseLandmarks;
  
  // Eyebrows
  const leftBrowRaise = face ? calculateBrowRaise(face, FACE_LANDMARKS.leftEyebrow, FACE_LANDMARKS.leftEye) : 0;
  const rightBrowRaise = face ? calculateBrowRaise(face, FACE_LANDMARKS.rightEyebrow, FACE_LANDMARKS.rightEye) : 0;
  const browFurrow = face ? calculateBrowFurrow(face, FACE_LANDMARKS.leftEyebrow, FACE_LANDMARKS.rightEyebrow) : 0;
  
  const leftInner = getLandmark(face, FACE_LANDMARKS.leftEyebrow.inner);
  const rightInner = getLandmark(face, FACE_LANDMARKS.rightEyebrow.inner);
  const browInnerDistance = (leftInner && rightInner) ? dist2d(leftInner, rightInner) : 0;
  
  // Eyes
  const leftEyeOpenness = face ? calculateEyeOpenness(face, FACE_LANDMARKS.leftEye) : 0.5;
  const rightEyeOpenness = face ? calculateEyeOpenness(face, FACE_LANDMARKS.rightEye) : 0.5;
  
  const leftIris = getLandmark(face, FACE_LANDMARKS.leftEye.iris);
  const rightIris = getLandmark(face, FACE_LANDMARKS.rightEye.iris);
  const leftEyeLeft = getLandmark(face, FACE_LANDMARKS.leftEye.left);
  const leftEyeRight = getLandmark(face, FACE_LANDMARKS.leftEye.right);
  const rightEyeLeft = getLandmark(face, FACE_LANDMARKS.rightEye.left);
  const rightEyeRight = getLandmark(face, FACE_LANDMARKS.rightEye.right);
  
  let eyeGazeLeftRight = 0;
  const eyeGazeUpDown = 0;
  if (leftIris && leftEyeLeft && leftEyeRight) {
    const eyeCenterX = (leftEyeLeft.x + leftEyeRight.x) / 2;
    eyeGazeLeftRight = clamp((leftIris.x - eyeCenterX) * 4, -1, 1);
  }
  if (rightIris && rightEyeLeft && rightEyeRight) {
    const eyeCenterX = (rightEyeLeft.x + rightEyeRight.x) / 2;
    eyeGazeLeftRight = clamp((rightIris.x - eyeCenterX) * 4, -1, 1);
  }
  
  // Mouth
  const mouthOpen = face ? calculateMouthOpen(face) : 0;
  const mouthWidth = face ? calculateMouthWidth(face) : 0;
  const mouthHeight = mouthOpen;
  const mouthCornerRaise = face ? calculateMouthCornerRaise(face) : 0;
  const mouthPucker = face ? calculateMouthPucker(face) : 0;
  const mouthTension = face ? calculateMouthTension(face) : 0;
  
  // Head pose
  const { pitch, yaw, roll } = calculateHeadPose(pose);
  
  // Grammatical markers
  const avgBrowRaise = (leftBrowRaise + rightBrowRaise) / 2;
  const isQuestion = avgBrowRaise > 0.6 && browFurrow < 0.3;
  const isWhQuestion = browFurrow > 0.6;
  const isNegation = yaw < -20 || yaw > 20; // Head shake
  const isAffirmation = Math.abs(pitch) > 15 && Math.abs(yaw) < 10; // Head nod
  const isTopic = avgBrowRaise > 0.5 && browFurrow < 0.3;
  
  return {
    leftBrowRaise,
    rightBrowRaise,
    browFurrow,
    browInnerDistance,
    leftEyeOpenness,
    rightEyeOpenness,
    eyeGazeLeftRight,
    eyeGazeUpDown,
    mouthOpen,
    mouthWidth,
    mouthHeight,
    mouthCornerRaise,
    mouthPucker,
    mouthTension,
    headPitch: pitch,
    headYaw: yaw,
    headRoll: roll,
    isQuestion,
    isWhQuestion,
    isNegation,
    isAffirmation,
    isTopic,
  };
}

/** Get human-readable NMM description for UI feedback */
export function getNMMDescription(features: NMMFeatures): string[] {
  const descriptions: string[] = [];
  
  if (features.isQuestion) descriptions.push("🤔 Yes/No question (raised eyebrows)");
  if (features.isWhQuestion) descriptions.push("❓ WH-question (furrowed brows)");
  if (features.isNegation) descriptions.push("🙅 Negation (head shake)");
  if (features.isAffirmation) descriptions.push("✅ Affirmation (head nod)");
  if (features.isTopic) descriptions.push("📌 Topic marking (brow raise)");
  
  if (features.mouthPucker > 0.5) descriptions.push("👄 Puckered mouth");
  if (features.mouthCornerRaise > 0.3) descriptions.push("😊 Smile detected");
  if (features.mouthCornerRaise < -0.3) descriptions.push("☹️ Frown detected");
  if (features.mouthTension > 0.5) descriptions.push("😤 Tense lips");
  
  if (Math.abs(features.headYaw) > 20) descriptions.push(`👀 Head turned ${features.headYaw > 0 ? 'right' : 'left'}`);
  if (Math.abs(features.headPitch) > 15) descriptions.push(`📐 Head tilted ${features.headPitch > 0 ? 'down' : 'up'}`);
  
  return descriptions;
}

/** Check if NMM features are reliable (face landmarks detected with good confidence) */
export function isNMMDataReliable(results: MediaPipeHolisticResults): boolean {
  if (!results.faceLandmarks || results.faceLandmarks.length < 468) return false;
  
  // Check key landmarks have reasonable visibility
  const nose = results.faceLandmarks[1];
  const leftEye = results.faceLandmarks[33];
  const rightEye = results.faceLandmarks[263];
  
  return !!(nose && leftEye && rightEye);
}