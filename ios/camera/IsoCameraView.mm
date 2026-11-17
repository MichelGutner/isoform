// Fabric shell (New Architecture) of the camera: receives props and commands and
// emits events to JS. The camera itself is AVFoundation (`IsoCamera.swift`).
//
// There is no public .h: the @interface stays here so no header with C++
// enters the lib's Swift module.

#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>
// The Swift header (shared with the other modules) may mention AVKit types.
#import <AVKit/AVKit.h>

#import <react/renderer/components/IsoformSpec/ComponentDescriptors.h>
#import <react/renderer/components/IsoformSpec/EventEmitters.h>
#import <react/renderer/components/IsoformSpec/Props.h>
#import <react/renderer/components/IsoformSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

#if __has_include(<isoform/isoform-Swift.h>)
#import <isoform/isoform-Swift.h>
#else
#import "isoform-Swift.h"
#endif

using namespace facebook::react;

static NSString *toNSString(const std::string &value)
{
  return [NSString stringWithUTF8String:value.c_str()];
}

@interface IsoCameraView : RCTViewComponentView <RCTIsoCameraViewViewProtocol, IsoCameraHostDelegate>
@end

@implementation IsoCameraView {
  IsoCameraHost *_host;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<IsoCameraViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const IsoCameraViewProps>();
    _props = defaultProps;

    _host = [IsoCameraHost new];
    _host.delegate = self;
    _host.view.frame = self.bounds;
    _host.view.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    self.contentView = _host.view;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const IsoCameraViewProps>(props);

  NSMutableArray<NSString *> *types = [NSMutableArray arrayWithCapacity:next.codeTypes.size()];
  for (const auto &type : next.codeTypes) {
    [types addObject:toNSString(type)];
  }

  _host.zoomGesture = next.zoomGesture;
  _host.focusGesture = next.focusGesture;
  [_host setFlash:toNSString(toString(next.flash))];
  [_host setTorch:next.torch];
  [_host setZoom:next.zoom];
  [_host setFacing:toNSString(toString(next.facing))];
  [_host setVideo:next.video];
  [_host setAudio:next.audio];
  [_host setCodeScanner:next.codeScanner types:types];
  // last: it may start the camera, with everything above already set
  [_host setActive:next.active];

  [super updateProps:props oldProps:oldProps];
}

#pragma mark - Lifecycle

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  [_host setAttached:self.window != nil];
}

- (void)prepareForRecycle
{
  [super prepareForRecycle];
  [_host shutdown];
}

#pragma mark - Commands

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
  RCTIsoCameraViewHandleCommand(self, commandName, args);
}

- (void)takePhoto:(NSInteger)requestId flash:(NSString *)flash
{
  [_host takePhotoWithRequestId:requestId flash:flash];
}

- (void)startRecording:(NSInteger)requestId
{
  [_host startRecordingWithRequestId:requestId];
}

- (void)stopRecording:(NSInteger)requestId
{
  [_host stopRecordingWithRequestId:requestId];
}

- (void)requestPermission
{
  [_host requestPermission];
}

#pragma mark - Events → JS

- (std::shared_ptr<const IsoCameraViewEventEmitter>)emitter
{
  return std::static_pointer_cast<const IsoCameraViewEventEmitter>(_eventEmitter);
}

- (void)cameraDidBecomeReady
{
  if (auto emitter = [self emitter]) emitter->onCameraReady({});
}

- (void)cameraDidFailWithMessage:(NSString *)message
{
  if (auto emitter = [self emitter]) emitter->onCameraError({.message = message.UTF8String});
}

- (void)cameraPermissionChangedWithCamera:(NSString *)camera microphone:(NSString *)microphone
{
  if (auto emitter = [self emitter]) {
    emitter->onCameraPermission({.camera = camera.UTF8String, .microphone = microphone.UTF8String});
  }
}

- (void)cameraZoomChangedWithZoom:(double)zoom
{
  if (auto emitter = [self emitter]) emitter->onCameraZoom({.zoom = zoom});
}

- (void)cameraDidScanCodes:(NSArray<NSDictionary<NSString *, NSString *> *> *)codes
{
  auto emitter = [self emitter];
  if (!emitter) return;
  std::vector<IsoCameraViewEventEmitter::OnCameraCodesCodes> list;
  for (NSDictionary<NSString *, NSString *> *code in codes) {
    list.push_back({.value = code[@"value"].UTF8String, .type = code[@"type"].UTF8String});
  }
  emitter->onCameraCodes({.codes = list});
}

- (void)cameraDidTakePhotoWithRequestId:(NSInteger)requestId
                                    uri:(NSString *)uri
                                  width:(NSInteger)width
                                 height:(NSInteger)height
                                  error:(NSString *)error
{
  if (auto emitter = [self emitter]) {
    emitter->onCameraPhoto({
        .requestId = (int)requestId,
        .uri = uri.UTF8String,
        .width = (int)width,
        .height = (int)height,
        .error = error.UTF8String,
    });
  }
}

- (void)cameraDidStartRecordingWithRequestId:(NSInteger)requestId error:(NSString *)error
{
  if (auto emitter = [self emitter]) emitter->onCameraRecordStart({.requestId = (int)requestId, .error = error.UTF8String});
}

- (void)cameraDidFinishRecordingWithRequestId:(NSInteger)requestId
                                          uri:(NSString *)uri
                                     duration:(double)duration
                                        error:(NSString *)error
{
  if (auto emitter = [self emitter]) {
    emitter->onCameraRecordEnd({
        .requestId = (int)requestId,
        .uri = uri.UTF8String,
        .duration = duration,
        .error = error.UTF8String,
    });
  }
}

@end

Class<RCTComponentViewProtocol> IsoCameraViewCls(void)
{
  return IsoCameraView.class;
}
