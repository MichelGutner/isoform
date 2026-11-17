// Fabric shell (New Architecture) of the image: receives props, runs the `ref`
// commands and emits events to JS. Loading, caching, drawing and the gestures are
// Swift (`IsoImage.swift`, `IsoImagePipeline.swift`).
//
// There is no public .h: the @interface stays here so no header with C++
// enters the lib's Swift module.

#import <React/RCTConversions.h>
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

@interface IsoImageView : RCTViewComponentView <RCTIsoImageViewViewProtocol, IsoImageHostDelegate>
@end

@implementation IsoImageView {
  IsoImageHost *_host;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<IsoImageViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const IsoImageViewProps>();
    _props = defaultProps;

    _host = [IsoImageHost new];
    _host.delegate = self;
    _host.view.frame = self.bounds;
    _host.view.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    self.contentView = _host.view;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const IsoImageViewProps>(props);

  NSMutableArray<NSString *> *headers = [NSMutableArray arrayWithCapacity:next.headers.size()];
  for (const auto &header : next.headers) {
    [headers addObject:toNSString(header)];
  }
  [_host setSource:toNSString(next.uri) cacheKey:toNSString(next.cacheKey) headers:headers];
  [_host setPlaceholder:toNSString(next.placeholderUri) blurhash:toNSString(next.blurhash)];
  [_host setFit:toNSString(toString(next.contentFit)) positionX:next.positionX positionY:next.positionY];
  [_host setTransition:next.transition];
  [_host setTint:next.tintColor ? RCTUIColorFromSharedColor(next.tintColor) : nil];
  [_host setBlurRadius:next.blurRadius];
  [_host setCachePolicy:toNSString(toString(next.cachePolicy)) priority:toNSString(toString(next.priority))];
  [_host setAutoplay:next.autoplay];
  [_host setZoom:next.zoomable maxZoom:next.maxZoom doubleTapZoom:next.doubleTapZoom rotatable:next.rotatable];
  [_host setCornerRadius:next.cornerRadius];
  // last: starts the loads with every prop above already set
  [_host commit];

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
  [_host reset];
}

#pragma mark - Commands (the `ref`)

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
  RCTIsoImageViewHandleCommand(self, commandName, args);
}

- (void)zoomTo:(double)scale focusX:(double)focusX focusY:(double)focusY animated:(BOOL)animated
{
  [_host zoomTo:scale focusX:focusX focusY:focusY animated:animated];
}

- (void)resetZoom:(BOOL)animated
{
  [_host resetZoomWithAnimated:animated];
}

- (void)rotateTo:(double)degrees animated:(BOOL)animated
{
  [_host rotateTo:degrees animated:animated];
}

- (void)play
{
  [_host play];
}

- (void)pause
{
  [_host pause];
}

- (void)reload
{
  [_host reload];
}

#pragma mark - Events → JS

- (std::shared_ptr<const IsoImageViewEventEmitter>)emitter
{
  return std::static_pointer_cast<const IsoImageViewEventEmitter>(_eventEmitter);
}

- (void)imageDidStart
{
  if (auto emitter = [self emitter]) emitter->onImageLoadStart({});
}

- (void)imageDidProgressWithLoaded:(double)loaded total:(double)total
{
  if (auto emitter = [self emitter]) emitter->onImageProgress({.loaded = loaded, .total = total});
}

- (void)imageDidLoadWithWidth:(double)width height:(double)height cacheType:(NSString *)cacheType
{
  if (auto emitter = [self emitter]) emitter->onImageLoad({.width = width, .height = height, .cacheType = std::string(cacheType.UTF8String)});
}

- (void)imageDidFailWithMessage:(NSString *)message
{
  if (auto emitter = [self emitter]) emitter->onImageError({.message = std::string(message.UTF8String)});
}

- (void)imageDidZoomWithScale:(double)scale x:(double)x y:(double)y rotation:(double)rotation
{
  if (auto emitter = [self emitter]) emitter->onImageZoom({.scale = scale, .x = x, .y = y, .rotation = rotation});
}

@end

Class<RCTComponentViewProtocol> IsoImageViewCls(void)
{
  return IsoImageView.class;
}
