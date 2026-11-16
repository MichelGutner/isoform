// Fabric shell (New Architecture) of the date picker: receives props and emits
// events to JS. The picker itself is a SwiftUI `DatePicker` (`OmniDatePicker.swift`).
//
// There is no public .h: the @interface stays here so no header with C++
// enters the lib's Swift module.

#import <React/RCTConversions.h>
#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>
// The Swift header (shared with the other modules) may mention AVKit types.
#import <AVKit/AVKit.h>

#import <react/renderer/components/OmnistyleSpec/ComponentDescriptors.h>
#import <react/renderer/components/OmnistyleSpec/EventEmitters.h>
#import <react/renderer/components/OmnistyleSpec/Props.h>
#import <react/renderer/components/OmnistyleSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

#if __has_include(<omnistyle/omnistyle-Swift.h>)
#import <omnistyle/omnistyle-Swift.h>
#else
#import "omnistyle-Swift.h"
#endif

using namespace facebook::react;

static NSString *toNSString(const std::string &value)
{
  return [NSString stringWithUTF8String:value.c_str()];
}

@interface OmniDatePickerView : RCTViewComponentView <RCTOmniDatePickerViewViewProtocol, OmniDatePickerHostDelegate>
@end

@implementation OmniDatePickerView {
  OmniDatePickerHost *_host;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<OmniDatePickerViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const OmniDatePickerViewProps>();
    _props = defaultProps;

    _host = [OmniDatePickerHost new];
    _host.delegate = self;
    _host.view.frame = self.bounds;
    _host.view.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    self.contentView = _host.view;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const OmniDatePickerViewProps>(props);

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

- (std::shared_ptr<const OmniDatePickerViewEventEmitter>)emitter
{
  return std::static_pointer_cast<const OmniDatePickerViewEventEmitter>(_eventEmitter);
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

Class<RCTComponentViewProtocol> OmniDatePickerViewCls(void)
{
  return OmniDatePickerView.class;
}
