// Fabric shell (New Architecture) of the PDF viewer: receives props and commands
// and emits events to JS. The viewer lives in `IsoPdfViewer.swift` (PDFKit + UIKit).
//
// There is no public .h: the @interface stays here so no header with C++
// enters the lib's Swift module.

#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>
// The generated Swift header is shared with the video and audio: it cites AVKit types when they are built.
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

static NSString *IsoString(const std::string &value)
{
  return [NSString stringWithUTF8String:value.c_str()];
}

@interface IsoPdfView : RCTViewComponentView <RCTIsoPdfViewViewProtocol, IsoPdfViewerDelegate>
@end

@implementation IsoPdfView {
  IsoPdfViewer *_viewer;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<IsoPdfViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const IsoPdfViewProps>();
    _props = defaultProps;

    _viewer = [[IsoPdfViewer alloc] initWithFrame:self.bounds];
    _viewer.delegate = self;
    self.contentView = _viewer;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const IsoPdfViewProps>(props);

  // The viewer's setters ignore repeated values (e.g. the same `src` does not reload).
  [_viewer setControls:next.controls];
  [_viewer setInitialPage:next.initialPage];
  [_viewer setNightMode:next.nightMode];
  [_viewer setFit:IsoString(toString(next.fit))];
  [_viewer setDirection:IsoString(toString(next.direction))];
  [_viewer setMaxZoom:next.maxZoom];
  [_viewer setSpeechLanguage:IsoString(next.speechLanguage)];
  [_viewer setSpeechVoice:IsoString(next.speechVoice)];
  [_viewer setPlaylistWithIndex:next.playlistIndex count:next.playlistCount];
  [_viewer setPassword:IsoString(next.password)];
  [_viewer setSource:IsoString(next.src)];

  [super updateProps:props oldProps:oldProps];
}

- (void)prepareForRecycle
{
  [super prepareForRecycle];
  [_viewer reset];
}

#pragma mark - Commands

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
  RCTIsoPdfViewHandleCommand(self, commandName, args);
}

- (void)goToPage:(NSInteger)page
{
  [_viewer goToPage:page];
}

- (void)search:(NSString *)query
{
  [_viewer search:query];
}

- (void)searchNext
{
  [_viewer searchNext];
}

- (void)searchPrevious
{
  [_viewer searchPrevious];
}

- (void)clearSearch
{
  [_viewer clearSearch];
}

- (void)setZoom:(float)scale
{
  [_viewer setZoom:scale];
}

- (void)setFullscreen:(BOOL)fullscreen
{
  [_viewer setFullscreen:fullscreen];
}

- (void)startReadAloud
{
  [_viewer startReadAloud];
}

- (void)stopReadAloud
{
  [_viewer stopReadAloud];
}

#pragma mark - Events → JS

- (std::shared_ptr<const IsoPdfViewEventEmitter>)emitter
{
  return std::static_pointer_cast<const IsoPdfViewEventEmitter>(_eventEmitter);
}

- (void)pdfDidLoadWithPageCount:(NSInteger)pageCount
{
  if (auto emitter = [self emitter]) emitter->onPdfLoad({.pageCount = (int)pageCount});
}

- (void)pdfDidChangePage:(NSInteger)page pageCount:(NSInteger)pageCount
{
  if (auto emitter = [self emitter]) emitter->onPdfPage({.page = (int)page, .pageCount = (int)pageCount});
}

- (void)pdfDidSearch:(NSString *)query total:(NSInteger)total current:(NSInteger)current
{
  if (auto emitter = [self emitter]) {
    emitter->onPdfSearch({.query = std::string(query.UTF8String), .total = (int)total, .current = (int)current});
  }
}

- (void)pdfDidFail:(NSString *)message
{
  if (auto emitter = [self emitter]) emitter->onPdfError({.message = std::string(message.UTF8String)});
}

- (void)pdfNeedsPassword
{
  if (auto emitter = [self emitter]) emitter->onPdfPassword({});
}

- (void)pdfDidPressLink:(NSString *)url
{
  if (auto emitter = [self emitter]) emitter->onPdfLink({.url = std::string(url.UTF8String)});
}

- (void)pdfDidChangeFullscreen:(BOOL)fullscreen
{
  if (auto emitter = [self emitter]) emitter->onPdfFullscreen({.fullscreen = (bool)fullscreen});
}

- (void)pdfDidChangeReadAloud:(BOOL)reading
{
  if (auto emitter = [self emitter]) emitter->onPdfReadAloud({.reading = (bool)reading});
}

- (void)pdfDidPressPlaylist
{
  if (auto emitter = [self emitter]) emitter->onPdfPlaylist({});
}

@end

Class<RCTComponentViewProtocol> IsoPdfViewCls(void)
{
  return IsoPdfView.class;
}
