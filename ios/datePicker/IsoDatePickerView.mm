// Fabric shell (New Architecture) of the date picker: receives props and emits
// events to JS. The picker itself is a SwiftUI `DatePicker` (`IsoDatePicker.swift`).
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

@interface IsoDatePickerView : RCTViewComponentView <RCTIsoDatePickerViewViewProtocol, IsoDatePickerHostDelegate>
@end

@implementation IsoDatePickerView {
  IsoDatePickerHost *_host;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<IsoDatePickerViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const IsoDatePickerViewProps>();
    _props = defaultProps;

    _host = [IsoDatePickerHost new];
    _host.delegate = self;
    _host.view.frame = self.bounds;
    _host.view.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    self.contentView = _host.view;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const IsoDatePickerViewProps>(props);

  [_host setMode:toNSString(toString(next.mode))];
  [_host setDisplay:toNSString(toString(next.display))];
  [_host setMinimum:next.minimumDate];
  [_host setMaximum:next.maximumDate];
  [_host setLocale:toNSString(next.locale)];
  [_host setHourCycle:toNSString(toString(next.hourCycle))];
  [_host setTint:next.tintColor ? RCTUIColorFromSharedColor(next.tintColor) : nil];
  [_host setDisabled:next.disabled];
  // last: the value is shown with the mode, limits and locale above already set
  [_host setMoment:next.value];

  [super updateProps:props oldProps:oldProps];
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

- (std::shared_ptr<const IsoDatePickerViewEventEmitter>)emitter
{
  return std::static_pointer_cast<const IsoDatePickerViewEventEmitter>(_eventEmitter);
}

- (void)datePickerDidChangeWithValue:(double)value
{
  if (auto emitter = [self emitter]) emitter->onPickerChange({.value = value});
}

- (void)datePickerDidMeasureWithWidth:(double)width height:(double)height
{
  if (auto emitter = [self emitter]) emitter->onPickerSize({.width = width, .height = height});
}

@end

Class<RCTComponentViewProtocol> IsoDatePickerViewCls(void)
{
  return IsoDatePickerView.class;
}
