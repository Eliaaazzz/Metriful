//
//  GetDepthAtCenterPlugin.m
//  Registers the Swift frame-processor plugin with VisionCamera so JS can call
//  it as `global.__getDepthAtCenter(frame)`.
//
//  Replace `YourApp` with your actual product module name (the Swift bridging header).
//

#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>

#if __has_include("YourApp-Swift.h")
#import "YourApp-Swift.h"
#else
#import <YourApp/YourApp-Swift.h>
#endif

@interface GetDepthAtCenterPluginRegistration : NSObject
@end

@implementation GetDepthAtCenterPluginRegistration

+ (void)load {
  [FrameProcessorPluginRegistry addFrameProcessorPlugin:@"getDepthAtCenter"
                                        withInitializer:^FrameProcessorPlugin* _Nonnull(VisionCameraProxyHolder* _Nonnull proxy,
                                                                                        NSDictionary* _Nullable options) {
    return [[GetDepthAtCenterPlugin alloc] initWithProxy:proxy options:options];
  }];
}

@end
