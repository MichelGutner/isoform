// Casca Fabric (New Architecture) do vídeo: recebe props, comandos e emite
// eventos para o JS. A reprodução fica toda em `OmniVideoPlayer.swift`.
//
// Não há .h público: o @interface fica aqui para que nenhum header com C++
// entre no módulo Swift da lib.

#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>
// O header gerado do Swift cita `AVPlayerViewControllerDelegate` sem importar o AVKit.
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

@interface OmniVideoView : RCTViewComponentView <RCTOmniVideoViewViewProtocol, OmniVideoPlayerDelegate>
@end

@implementation OmniVideoView {
  OmniVideoPlayer *_player;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<OmniVideoViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const OmniVideoViewProps>();
    _props = defaultProps;

    _player = [[OmniVideoPlayer alloc] initWithFrame:self.bounds];
    _player.delegate = self;
    self.contentView = _player;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const OmniVideoViewProps>(props);

  // Os setters do player ignoram valores repetidos (ex.: a mesma `src` não recarrega).
  [_player setControls:next.controls];
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

#pragma mark - Comandos (play / pause / seekTo / setFullscreen)

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
  RCTOmniVideoViewHandleCommand(self, commandName, args);
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

- (void)setFullscreen:(BOOL)fullscreen
{
  [_player setFullscreen:fullscreen];
}

#pragma mark - Eventos → JS

- (std::shared_ptr<const OmniVideoViewEventEmitter>)emitter
{
  return std::static_pointer_cast<const OmniVideoViewEventEmitter>(_eventEmitter);
}

- (void)playerDidPlay
{
  if (auto emitter = [self emitter]) emitter->onPlayerPlay({});
}

- (void)playerDidPause
{
  if (auto emitter = [self emitter]) emitter->onPlayerPause({});
}

- (void)playerDidEnd
{
  if (auto emitter = [self emitter]) emitter->onPlayerEnd({});
}

- (void)playerDidUpdateTime:(double)currentTime duration:(double)duration
{
  if (auto emitter = [self emitter]) {
    emitter->onPlayerTime({.currentTime = currentTime, .duration = duration});
  }
}

- (void)playerDidLoad:(double)duration width:(double)width height:(double)height
{
  if (auto emitter = [self emitter]) emitter->onPlayerLoad({.duration = duration, .width = width, .height = height});
}

- (void)playerDidFail:(NSString *)message
{
  if (auto emitter = [self emitter]) emitter->onPlayerError({.message = std::string(message.UTF8String)});
}

- (void)playerDidSeekFrom:(double)from to:(double)to
{
  if (auto emitter = [self emitter]) emitter->onPlayerSeek({.from = from, .to = to});
}

- (void)playerDidChangeBuffering:(BOOL)buffering
{
  if (auto emitter = [self emitter]) emitter->onPlayerBuffering({.buffering = (bool)buffering});
}

- (void)playerDidChangeBuffered:(double)buffered
{
  if (auto emitter = [self emitter]) emitter->onPlayerBuffered({.buffered = buffered});
}

- (void)playerDidChangeFullscreen:(BOOL)fullscreen
{
  if (auto emitter = [self emitter]) emitter->onPlayerFullscreen({.fullscreen = (bool)fullscreen});
}

- (void)playerDidChangeVolume:(double)volume muted:(BOOL)muted
{
  if (auto emitter = [self emitter]) emitter->onPlayerVolume({.volume = volume, .muted = (bool)muted});
}

- (void)playerDidChangeRate:(double)rate
{
  if (auto emitter = [self emitter]) emitter->onPlayerRate({.rate = rate});
}

@end

Class<RCTComponentViewProtocol> OmniVideoViewCls(void)
{
  return OmniVideoView.class;
}
