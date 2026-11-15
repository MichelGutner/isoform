// Fabric shell (New Architecture) of the audio: receives props and commands and
// emits events to JS. Playback lives in `OmniAudioPlayer.swift` and the card UI
// in `OmniAudioCard.swift`.
//
// There is no public .h: the @interface stays here so no header with C++
// enters the lib's Swift module.

#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>

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

@interface OmniAudioView : RCTViewComponentView <RCTOmniAudioViewViewProtocol, OmniAudioPlayerDelegate>
@end

@implementation OmniAudioView {
  OmniAudioPlayer *_player;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<OmniAudioViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const OmniAudioViewProps>();
    _props = defaultProps;

    _player = [[OmniAudioPlayer alloc] initWithFrame:self.bounds];
    _player.delegate = self;
    self.contentView = _player;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const OmniAudioViewProps>(props);

  // The player's setters ignore repeated values (e.g. the same `src` does not reload).
  [_player setControls:next.controls];
  [_player setTitle:[NSString stringWithUTF8String:next.title.c_str()]];
  [_player setArtist:[NSString stringWithUTF8String:next.artist.c_str()]];
  [_player setArtwork:[NSString stringWithUTF8String:next.artwork.c_str()]];
  [_player setAutoPlay:next.autoPlay];
  [_player setLoop:next.loop];
  [_player setMuted:next.muted];
  [_player setRate:next.rate];
  [_player setVolume:next.volume];
  [_player setSource:[NSString stringWithUTF8String:next.src.c_str()]];

  [super updateProps:props oldProps:oldProps];
}

- (void)prepareForRecycle
{
  [super prepareForRecycle];
  [_player reset];
}

#pragma mark - Commands (play / pause / seekTo)

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
  RCTOmniAudioViewHandleCommand(self, commandName, args);
}

- (void)play
{
  [_player play];
}

- (void)pause
{
  [_player pause];
}

- (void)seekTo:(double)seconds
{
  [_player seekTo:seconds];
}

#pragma mark - Events → JS

- (std::shared_ptr<const OmniAudioViewEventEmitter>)emitter
{
  return std::static_pointer_cast<const OmniAudioViewEventEmitter>(_eventEmitter);
}

- (void)audioDidPlay
{
  if (auto emitter = [self emitter]) emitter->onPlayerPlay({});
}

- (void)audioDidPause
{
  if (auto emitter = [self emitter]) emitter->onPlayerPause({});
}

- (void)audioDidEnd
{
  if (auto emitter = [self emitter]) emitter->onPlayerEnd({});
}

- (void)audioDidUpdateTime:(double)currentTime duration:(double)duration
{
  if (auto emitter = [self emitter]) emitter->onPlayerTime({.currentTime = currentTime, .duration = duration});
}

- (void)audioDidLoad:(double)duration
{
  if (auto emitter = [self emitter]) emitter->onPlayerLoad({.duration = duration});
}

- (void)audioDidFail:(NSString *)message
{
  if (auto emitter = [self emitter]) emitter->onPlayerError({.message = std::string(message.UTF8String)});
}

- (void)audioDidSeekFrom:(double)from to:(double)to
{
  if (auto emitter = [self emitter]) emitter->onPlayerSeek({.from = from, .to = to});
}

- (void)audioDidChangeBuffering:(BOOL)buffering
{
  if (auto emitter = [self emitter]) emitter->onPlayerBuffering({.buffering = (bool)buffering});
}

- (void)audioDidChangeBuffered:(double)buffered
{
  if (auto emitter = [self emitter]) emitter->onPlayerBuffered({.buffered = buffered});
}

- (void)audioDidChangeVolume:(double)volume muted:(BOOL)muted
{
  if (auto emitter = [self emitter]) emitter->onPlayerVolume({.volume = volume, .muted = (bool)muted});
}

- (void)audioDidChangeRate:(double)rate
{
  if (auto emitter = [self emitter]) emitter->onPlayerRate({.rate = rate});
}

@end

Class<RCTComponentViewProtocol> OmniAudioViewCls(void)
{
  return OmniAudioView.class;
}
