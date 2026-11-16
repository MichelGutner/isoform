// Casca vazia do date picker, compilada quando o módulo está fora do build
// (desligado no `omnistyle.config.json` do app).
//
// O app gerado pelo React Native registra os componentes da lib com
// `NSClassFromString(@"OmniDatePickerView")` dentro de um dicionário: se a classe não
// existir, o app quebra ao abrir. Esta casca mantém o nome (sem SwiftUI)
// e só desenha uma view vazia — o JS nem chega a renderizá-la com o módulo desligado.

#import <React/RCTViewComponentView.h>

#import <react/renderer/components/OmnistyleSpec/ComponentDescriptors.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface OmniDatePickerView : RCTViewComponentView
@end

@implementation OmniDatePickerView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<OmniDatePickerViewComponentDescriptor>();
}

@end

Class<RCTComponentViewProtocol> OmniDatePickerViewCls(void)
{
  return OmniDatePickerView.class;
}
