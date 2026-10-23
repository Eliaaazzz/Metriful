//
//  ARScaleModule.m
//  Exposes the Swift ARScaleModule to React Native as NativeModules.ARScaleModule.
//  (Standard-AR / no-LiDAR scale source — see ARScaleModule.swift.)
//
//  ⚠️ REFERENCE TEMPLATE — add these files to your Xcode target and build on a real device.
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ARScaleModule, NSObject)

RCT_EXTERN_METHOD(isSupported:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(start:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stop:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(measure:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
