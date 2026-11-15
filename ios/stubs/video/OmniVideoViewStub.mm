// Casca vazia do vídeo, compilada quando o vídeo está fora do build
// (desligado no `omnistyle.config.json` do app).
//
// O app gerado pelo React Native registra os componentes da lib com
// `NSClassFromString(@"OmniVideoView")` dentro de um dicionário: se a classe não
// existir, o app quebra ao abrir. Esta casca mantém o nome (sem AVKit, sem Swift)
// e só desenha uma view vazia — o JS nem chega a renderizá-la com o módulo desligado.

#import <React/RCTViewComponentView.h>

#import <react/renderer/components/OmnistyleSpec/ComponentDescriptors.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface OmniVideoView : RCTViewComponentView
@end

@implementation OmniVideoView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<OmniVideoViewComponentDescriptor>();
}

@end

Class<RCTComponentViewProtocol> OmniVideoViewCls(void)
{
  return OmniVideoView.class;
}
