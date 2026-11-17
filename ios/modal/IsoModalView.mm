// Fabric shell (New Architecture) of the modal: receives props, keeps the React
// children and emits events to JS. The modal itself is UIKit (`IsoModal.swift`),
// drawn inside this view: JS puts the view, full screen, in a transparent React
// Native `Modal` (as on Android), whose window already routes touches and the
// keyboard to React Native views. Fabric mounts the children here and we move them
// into the card.
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

@interface IsoModalView : RCTViewComponentView <RCTIsoModalViewViewProtocol, IsoModalHostDelegate>
@end

@implementation IsoModalView {
  IsoModalHost *_host;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<IsoModalViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const IsoModalViewProps>();
    _props = defaultProps;

    _host = [IsoModalHost new];
    _host.delegate = self;
    _host.view.frame = self.bounds;
    _host.view.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    self.contentView = _host.view;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const IsoModalViewProps>(props);

  [_host setPresentation:toNSString(toString(next.presentation)) animation:toNSString(toString(next.animation)) dismissible:next.dismissible];
  [_host setColorsWithBackdrop:next.backdropColor ? RCTUIColorFromSharedColor(next.backdropColor) : nil
                       surface:next.surfaceColor ? RCTUIColorFromSharedColor(next.surfaceColor) : nil
                  cornerRadius:next.cornerRadius];
  [_host setSizeWithMaxWidth:next.maxWidth contentHeight:next.contentHeight];
  // last: opening may present right away, with everything above already set
  [_host setOpen:next.open];

  [super updateProps:props oldProps:oldProps];
}

#pragma mark - Children: live in the card, not directly in this view

- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView index:(NSInteger)index
{
  [_host.contentView insertSubview:childComponentView atIndex:index];
}

- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView index:(NSInteger)index
{
  [childComponentView removeFromSuperview];
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
  [_host setAttached:NO];
}

#pragma mark - Events → JS

- (std::shared_ptr<const IsoModalViewEventEmitter>)emitter
{
  return std::static_pointer_cast<const IsoModalViewEventEmitter>(_eventEmitter);
}

- (void)modalDidLayoutWithWidth:(double)width height:(double)height
{
  if (auto emitter = [self emitter]) emitter->onModalLayout({.width = width, .height = height});
}

- (void)modalDidDismiss
{
  if (auto emitter = [self emitter]) emitter->onModalDismiss({});
}

- (void)modalDidClose
{
  if (auto emitter = [self emitter]) emitter->onModalClosed({});
}

@end

Class<RCTComponentViewProtocol> IsoModalViewCls(void)
{
  return IsoModalView.class;
}
