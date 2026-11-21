// Fabric shell (New Architecture) of `.gesture()`: a regular React Native view
// (background, borders, children) that also carries UIKit gesture recognizers
// (`IsoGesture.swift`). Its events are bound in JS to `Animated.Value`s with the
// native driver, so the view follows the fingers without a trip through JS.
//
// There is no public .h: the @interface stays here so no header with C++
// enters the lib's Swift module.

#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>
// The Swift header (shared with the other modules) may mention AVKit types.
#import <AVKit/AVKit.h>

#import <React/RCTConstants.h>
#import <React/RCTEventDispatcherProtocol.h>
#import <folly/dynamic.h>
#import <react/featureflags/ReactNativeFeatureFlags.h>
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

/// A gesture event in the shape the legacy native-animated module reads: `arguments` = viewTag, name, body.
@interface IsoGestureAnimatedEvent : NSObject <RCTEvent>
- (instancetype)initWithTag:(NSNumber *)tag name:(NSString *)name body:(NSDictionary *)body;
@end

@implementation IsoGestureAnimatedEvent {
  NSDictionary *_body;
}

@synthesize viewTag = _viewTag;
@synthesize eventName = _eventName;

- (instancetype)initWithTag:(NSNumber *)tag name:(NSString *)name body:(NSDictionary *)body
{
  if (self = [super init]) {
    _viewTag = tag;
    _eventName = name;
    _body = body;
  }
  return self;
}

- (BOOL)canCoalesce
{
  return NO;
}

+ (NSString *)moduleDotMethod
{
  return @"RCTEventEmitter.receiveEvent";
}

- (NSArray *)arguments
{
  return @[ _viewTag, RCTNormalizeInputEventName(_eventName), _body ];
}

@end

@interface IsoGestureView : RCTViewComponentView <RCTIsoGestureViewViewProtocol, IsoGestureHostDelegate>
@end

@implementation IsoGestureView {
  IsoGestureHost *_host;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<IsoGestureViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const IsoGestureViewProps>();
    _props = defaultProps;

    _host = [[IsoGestureHost alloc] initWithView:self];
    _host.delegate = self;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const IsoGestureViewProps>(props);

  [_host configureWithPanAxis:[NSString stringWithUTF8String:toString(next.panAxis).c_str()]
                        pinch:next.pinchEnabled
                       rotate:next.rotateEnabled
                    doubleTap:next.doubleTapEnabled
                    longPress:next.longPressEnabled
            longPressDuration:next.longPressDuration
                 simultaneous:next.simultaneous];

  [super updateProps:props oldProps:oldProps];
}

- (void)prepareForRecycle
{
  [super prepareForRecycle];
  [_host reset];
}

#pragma mark - Commands

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
  RCTIsoGestureViewHandleCommand(self, commandName, args);
}

- (void)haptic:(NSInteger)kind
{
  [_host hapticWithKind:kind];
}

#pragma mark - Events → JS

// Every event goes two ways:
//  · to JS (and to the C++ native-animated backend) through Fabric, with a `folly::dynamic` payload.
//    Not through the Codegen emitter methods (`onIsoPan(...)`): those build the payload lazily in JS
//    (`ValueFactoryEventPayload`), which the native driver cannot read.
//  · to the legacy native-animated module (the default on iOS while `cxxNativeAnimatedEnabled` is off),
//    which only hears events from the old `RCTEventDispatcher`, never Fabric's. React Native's own
//    ScrollView does the same for `onScroll` (`RCTSendScrollEventForNativeAnimations_DEPRECATED`).
// Without the second one, `Animated.event(..., { useNativeDriver: true })` never moves the view.

- (void)send:(NSString *)name body:(NSDictionary<NSString *, NSNumber *> *)body
{
  if (_eventEmitter) {
    folly::dynamic payload = folly::dynamic::object();
    for (NSString *key in body) {
      payload[key.UTF8String] = body[key].doubleValue;
    }
    // `isoPan` → `topIsoPan` → the `onIsoPan` prop (the Codegen event type)
    _eventEmitter->dispatchEvent(std::string(name.UTF8String), std::move(payload));
  }
  if (!ReactNativeFeatureFlags::cxxNativeAnimatedEnabled()) {
    // `isoPan` → `topIsoPan`: the module strips `top`/`on` and compares with the prop (`onIsoPan` → `IsoPan`)
    NSString *legacyName = [NSString
        stringWithFormat:@"top%@%@", [[name substringToIndex:1] uppercaseString], [name substringFromIndex:1]];
    IsoGestureAnimatedEvent *event = [[IsoGestureAnimatedEvent alloc] initWithTag:@(self.tag) name:legacyName body:body];
    [[NSNotificationCenter defaultCenter] postNotificationName:RCTNotifyEventDispatcherObserversOfEvent_DEPRECATED
                                                        object:nil
                                                      userInfo:@{@"event" : event}];
  }
}

- (void)gesturePanWithState:(NSInteger)state
               translationX:(double)translationX
               translationY:(double)translationY
                  velocityX:(double)velocityX
                  velocityY:(double)velocityY
                          x:(double)x
                          y:(double)y
{
  [self send:@"isoPan"
        body:@{
          @"state" : @(state),
          @"translationX" : @(translationX),
          @"translationY" : @(translationY),
          @"velocityX" : @(velocityX),
          @"velocityY" : @(velocityY),
          @"x" : @(x),
          @"y" : @(y),
        }];
}

- (void)gesturePinchWithState:(NSInteger)state
                        scale:(double)scale
                     velocity:(double)velocity
                       focalX:(double)focalX
                       focalY:(double)focalY
{
  [self send:@"isoPinch"
        body:@{@"state" : @(state), @"scale" : @(scale), @"velocity" : @(velocity), @"focalX" : @(focalX), @"focalY" : @(focalY)}];
}

- (void)gestureRotateWithState:(NSInteger)state rotation:(double)rotation velocity:(double)velocity
{
  [self send:@"isoRotate" body:@{@"state" : @(state), @"rotation" : @(rotation), @"velocity" : @(velocity)}];
}

- (void)gestureTapWithKind:(NSInteger)kind x:(double)x y:(double)y
{
  [self send:@"isoTap" body:@{@"kind" : @(kind), @"x" : @(x), @"y" : @(y)}];
}

@end

Class<RCTComponentViewProtocol> IsoGestureViewCls(void)
{
  return IsoGestureView.class;
}
