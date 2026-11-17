// Casca vazia do vídeo, compilada quando o vídeo está fora do build
// (desligado no `isoform.config.json` do app).
//
// O app gerado pelo React Native registra os componentes da lib com
// `NSClassFromString(@"IsoVideoView")` dentro de um dicionário: se a classe não
// existir, o app quebra ao abrir. Esta casca mantém o nome (sem AVKit, sem Swift)
// e só desenha uma view vazia — o JS nem chega a renderizá-la com o módulo desligado.

#import <React/RCTViewComponentView.h>

#import <react/renderer/components/IsoformSpec/ComponentDescriptors.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface IsoVideoView : RCTViewComponentView
@end

@implementation IsoVideoView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<IsoVideoViewComponentDescriptor>();
}

@end

Class<RCTComponentViewProtocol> IsoVideoViewCls(void)
{
  return IsoVideoView.class;
}
