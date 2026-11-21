// Casca vazia dos gestos, compilada quando o módulo está fora do build
// (desligado no `isoform.config.json` do app).
//
// O app gerado pelo React Native registra os componentes da lib com
// `NSClassFromString(@"IsoGestureView")` dentro de um dicionário: se a classe não
// existir, o app quebra ao abrir. Esta casca mantém o nome (sem SwiftUI)
// e só desenha uma view vazia — o JS nem chega a renderizá-la com o módulo desligado.

#import <React/RCTViewComponentView.h>

#import <react/renderer/components/IsoformSpec/ComponentDescriptors.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface IsoGestureView : RCTViewComponentView
@end

@implementation IsoGestureView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<IsoGestureViewComponentDescriptor>();
}

@end

Class<RCTComponentViewProtocol> IsoGestureViewCls(void)
{
  return IsoGestureView.class;
}
