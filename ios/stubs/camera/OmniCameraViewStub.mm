// Casca vazia da câmera, compilada quando a câmera está fora do build
// (desligado no `omnistyle.config.json` do app).
//
// O app gerado pelo React Native registra os componentes da lib com
// `NSClassFromString(@"OmniCameraView")` dentro de um dicionário: se a classe não
// existir, o app quebra ao abrir. Esta casca mantém o nome (sem AVFoundation)
// e só desenha uma view vazia — o JS nem chega a renderizá-la com o módulo desligado.

#import <React/RCTViewComponentView.h>

#import <react/renderer/components/OmnistyleSpec/ComponentDescriptors.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface OmniCameraView : RCTViewComponentView
@end

@implementation OmniCameraView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<OmniCameraViewComponentDescriptor>();
}

@end

Class<RCTComponentViewProtocol> OmniCameraViewCls(void)
{
  return OmniCameraView.class;
}
