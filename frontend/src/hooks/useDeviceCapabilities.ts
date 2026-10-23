/**
 * Device Capabilities Detection Hook
 *
 * Detects hardware features for progressive enhancement:
 * - Tier 1 (LiDAR/ToF): iPhone 12 Pro+, iPad Pro, Samsung Ultra, etc.
 * - Tier 2 (Standard AR): Most modern phones with ARKit/ARCore support
 * - Tier 3 (Fallback): Basic camera only
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

export type DeviceTier = 'lidar' | 'standard_ar' | 'basic';

export interface DeviceCapabilities {
  tier: DeviceTier;
  hasLiDAR: boolean;
  hasToF: boolean;
  hasARSupport: boolean;
  deviceModel: string;
  isHighEnd: boolean;
  estimatedAccuracy: string; // e.g., "< 1%", "< 5%", "< 15%"
}

// iPhone models with LiDAR — ONLY the Pro / Pro Max line carries a LiDAR scanner.
// (The standard iPhone 13 / 13 mini have no LiDAR and must not be listed here.)
const LIDAR_IPHONE_MODELS = [
  'iPhone13,3', 'iPhone13,4', // iPhone 12 Pro, Pro Max
  'iPhone14,2', 'iPhone14,3', // iPhone 13 Pro, Pro Max
  'iPhone15,2', 'iPhone15,3', // iPhone 14 Pro, Pro Max
  'iPhone16,1', 'iPhone16,2', // iPhone 15 Pro, Pro Max
  'iPhone17,1', 'iPhone17,2', // iPhone 16 Pro, Pro Max
];

// iPad Pro models with LiDAR (2020+)
const LIDAR_IPAD_MODELS = [
  'iPad8,9', 'iPad8,10', 'iPad8,11', 'iPad8,12', // iPad Pro 2020 (11" 2nd gen / 12.9" 4th gen)
  'iPad13,4', 'iPad13,5', 'iPad13,6', 'iPad13,7', // iPad Pro 2021 11" 3rd gen
  'iPad13,8', 'iPad13,9', 'iPad13,10', 'iPad13,11', // iPad Pro 2021 12.9" 5th gen (M1)
  'iPad14,3', 'iPad14,4', 'iPad14,5', 'iPad14,6', // iPad Pro 2022 (11" 4th gen / 12.9" 6th gen)
];

// Android models known to have ToF sensors
const TOF_ANDROID_MODELS = [
  'SM-S918', 'SM-S928', // Samsung S23/S24 Ultra
  'SM-N986', 'SM-N981', // Samsung Note 20 Ultra
  'Pixel 7 Pro', 'Pixel 8 Pro', 'Pixel 9 Pro', // Google Pixel Pro
  'HUAWEI P40 Pro', 'HUAWEI P50 Pro', 'HUAWEI Mate 40 Pro',
];

function checkLiDARSupport(modelId: string): boolean {
  if (Platform.OS !== 'ios') return false;
  // Exact model-id membership. Device.modelId is the hardware identifier (e.g.
  // 'iPhone15,2'), so the old `modelId.includes('pro')` heuristic never matched a
  // real device AND, if fed a model NAME instead, would have falsely flagged the
  // LiDAR-less iPhone 11 Pro / 2018 iPad Pro. Exact match avoids both.
  return LIDAR_IPHONE_MODELS.includes(modelId) || LIDAR_IPAD_MODELS.includes(modelId);
}

function checkToFSupport(modelId: string, modelName: string): boolean {
  if (Platform.OS === 'android') {
    return TOF_ANDROID_MODELS.some(model =>
      modelId.includes(model) || modelName.includes(model)
    );
  }
  return false;
}

function checkARSupport(osVersion: string): boolean {
  if (Platform.OS === 'ios') {
    // ARKit requires iOS 11+ and A9 chip or later
    const majorVersion = parseInt(osVersion.split('.')[0], 10);
    return majorVersion >= 11;
  } else if (Platform.OS === 'android') {
    // ARCore requires Android 7.0+ (API 24)
    const majorVersion = parseInt(osVersion.split('.')[0], 10);
    return majorVersion >= 7;
  }
  return false;
}

export function useDeviceCapabilities(): DeviceCapabilities {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>({
    tier: 'basic',
    hasLiDAR: false,
    hasToF: false,
    hasARSupport: false,
    deviceModel: 'unknown',
    isHighEnd: false,
    estimatedAccuracy: '< 15%',
  });

  useEffect(() => {
    const detectCapabilities = async () => {
      try {
        const modelId = Device.modelId || '';
        const modelName = Device.modelName || '';
        const osVersion = Device.osVersion || '';
        const brand = Device.brand || '';

        const hasLiDAR = checkLiDARSupport(modelId);
        const hasToF = checkToFSupport(modelId, modelName);
        const hasARSupport = checkARSupport(osVersion);

        // Determine tier
        let tier: DeviceTier = 'basic';
        let estimatedAccuracy = '< 15%';
        let isHighEnd = false;

        if (hasLiDAR || hasToF) {
          tier = 'lidar';
          estimatedAccuracy = '< 1%';
          isHighEnd = true;
        } else if (hasARSupport) {
          tier = 'standard_ar';
          estimatedAccuracy = '< 5%';
          isHighEnd = brand.toLowerCase().includes('apple') ||
                      brand.toLowerCase().includes('samsung') ||
                      brand.toLowerCase().includes('google');
        }

        setCapabilities({
          tier,
          hasLiDAR,
          hasToF,
          hasARSupport,
          deviceModel: modelName || modelId,
          isHighEnd,
          estimatedAccuracy,
        });

        if (__DEV__) {
          console.log('[DeviceCapabilities] Detected:', {
            tier,
            hasLiDAR,
            hasToF,
            hasARSupport,
            model: modelName || modelId,
            osVersion,
          });
        }
      } catch (error) {
        console.warn('[DeviceCapabilities] Detection failed:', error);
        // Fallback to basic tier
      }
    };

    detectCapabilities();
  }, []);

  return capabilities;
}

/**
 * Get a human-readable description of the device tier
 */
export function getTierDescription(tier: DeviceTier): string {
  switch (tier) {
    case 'lidar':
      // This tier covers BOTH iOS LiDAR and Android ToF, so the label stays
      // sensor-agnostic — a Galaxy S23 Ultra (ToF) is not a LiDAR device.
      return 'Pro Accuracy (Depth Sensor)';
    case 'standard_ar':
      return 'Standard Accuracy (AR)';
    case 'basic':
    default:
      return 'Basic Mode';
  }
}

export default useDeviceCapabilities;
