// TurboModule behind `prefetchImages` and `clearImageCache`: forwards to the Swift
// pipeline (`IsoImageCache` in `IsoImagePipeline.swift`).

#import <Foundation/Foundation.h>
#import <AVKit/AVKit.h>
#import <IsoformSpec/IsoformSpec.h>

#if __has_include(<isoform/isoform-Swift.h>)
#import <isoform/isoform-Swift.h>
#else
#import "isoform-Swift.h"
#endif

@interface IsoImageModule : NSObject <NativeIsoImageModuleSpec>
@end

@implementation IsoImageModule

RCT_EXPORT_MODULE()

- (void)prefetch:(NSArray *)urls
         headers:(NSArray *)headers
          memory:(BOOL)memory
            disk:(BOOL)disk
         resolve:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject
{
  [IsoImageCache prefetch:urls headers:headers memory:memory disk:disk completion:^(BOOL ok) {
    resolve(@(ok));
  }];
}

- (void)clear:(BOOL)memory disk:(BOOL)disk resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [IsoImageCache clearWithMemory:memory disk:disk completion:^{
    resolve(nil);
  }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeIsoImageModuleSpecJSI>(params);
}

@end
