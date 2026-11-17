// Casca Fabric (New Architecture) do vídeo: recebe props, comandos e emite
// eventos para o JS. A reprodução fica toda em `IsoVideoPlayer.swift`.
//
// Não há .h público: o @interface fica aqui para que nenhum header com C++
// entre no módulo Swift da lib.

#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>
// O header gerado do Swift cita `AVPlayerViewControllerDelegate` sem importar o AVKit.
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

@interface IsoVideoView : RCTViewComponentView <RCTIsoVideoViewViewProtocol, IsoVideoPlayerDelegate>
@end

@implementation IsoVideoView {
  IsoVideoPlayer *_player;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<IsoVideoViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const IsoVideoViewProps>();
    _props = defaultProps;

    _player = [[IsoVideoPlayer alloc] initWithFrame:self.bounds];
    _player.delegate = self;
    self.contentView = _player;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const IsoVideoViewProps>(props);

  // Os setters do player ignoram valores repetidos (ex.: a mesma `src` não recarrega).
  [_player setControls:next.controls];
  [_player setAutoPlay:next.autoPlay];
  [_player setLoop:next.loop];
  [_player setMuted:next.muted];
  [_player setRate:next.rate];
  [_player setVolume:next.volume];
  [_player setPlaylistItems:[NSString stringWithUTF8String:next.playlistItems.c_str()]];
  [_player setPlaylistWithIndex:next.playlistIndex count:next.playlistCount];
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
  RCTIsoVideoViewHandleCommand(self, commandName, args);
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

- (std::shared_ptr<const IsoVideoViewEventEmitter>)emitter
{
  return std::static_pointer_cast<const IsoVideoViewEventEmitter>(_eventEmitter);
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

- (void)playerDidPressPlaylist
{
  if (auto emitter = [self emitter]) emitter->onPlayerPlaylist({});
}

- (void)playerDidSelectPlaylistItem:(NSInteger)index
{
  if (auto emitter = [self emitter]) emitter->onPlayerPlaylistSelect({.index = (int)index});
}

@end

Class<RCTComponentViewProtocol> IsoVideoViewCls(void)
{
  return IsoVideoView.class;
}
