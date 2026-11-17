// Fabric shell (New Architecture) of the bottom sheet: receives props, keeps the
// React children and emits events to JS. The sheet itself is SwiftUI
// (`IsoSheet.swift`): Fabric mounts the children here and we move them into the
// sheet's content view, with React Native's touch handler attached to it (the
// same thing React Native's own `Modal` does), so taps reach JS.
//
// There is no public .h: the @interface stays here so no header with C++
// enters the lib's Swift module.

#import <React/RCTConversions.h>
#import <React/RCTSurfaceTouchHandler.h>
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

@interface IsoSheetView : RCTViewComponentView <RCTIsoSheetViewViewProtocol, IsoSheetHostDelegate>
@end

@implementation IsoSheetView {
  IsoSheetHost *_host;
  RCTSurfaceTouchHandler *_touchHandler;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<IsoSheetViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const IsoSheetViewProps>();
    _props = defaultProps;

    _host = [IsoSheetHost new];
    _host.delegate = self;
    _touchHandler = [RCTSurfaceTouchHandler new];
    [_touchHandler attachToView:_host.contentView];
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const IsoSheetViewProps>(props);

  NSMutableArray<NSString *> *detents = [NSMutableArray arrayWithCapacity:next.detents.size()];
  for (const auto &detent : next.detents) {
    [detents addObject:[NSString stringWithUTF8String:detent.c_str()]];
  }
  [_host setDetents:detents];
  [_host setDetent:next.detent];
  [_host setContentHeight:next.contentHeight];
  [_host setDismissible:next.dismissible];
  [_host setModal:next.modal];
  [_host setGrabber:next.grabber];
  [_host setColor:next.sheetColor ? RCTUIColorFromSharedColor(next.sheetColor) : nil];
  [_host setCornerRadius:next.cornerRadius];
  // last: opening may present right away, with everything above already set
  [_host setOpen:next.open];

  [super updateProps:props oldProps:oldProps];
}

#pragma mark - Children: live in the sheet, not in this (zero-size) view

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
  if (self.window) {
    [_host attachTo:self];
  } else {
    [_host detach];
  }
}

- (void)prepareForRecycle
{
  [super prepareForRecycle];
  [_host detach];
}

#pragma mark - Events → JS

- (std::shared_ptr<const IsoSheetViewEventEmitter>)emitter
{
  return std::static_pointer_cast<const IsoSheetViewEventEmitter>(_eventEmitter);
}

- (void)sheetDidLayoutWithWidth:(double)width height:(double)height
{
  if (auto emitter = [self emitter]) emitter->onSheetLayout({.width = width, .height = height});
}

- (void)sheetDidDismiss
{
  if (auto emitter = [self emitter]) emitter->onSheetDismiss({});
}

- (void)sheetDidClose
{
  if (auto emitter = [self emitter]) emitter->onSheetClosed({});
}

- (void)sheetDidChangeDetentWithIndex:(NSInteger)index
{
  if (auto emitter = [self emitter]) emitter->onSheetDetent({.index = (int)index});
}

@end

Class<RCTComponentViewProtocol> IsoSheetViewCls(void)
{
  return IsoSheetView.class;
}
