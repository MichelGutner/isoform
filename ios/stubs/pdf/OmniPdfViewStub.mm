// Casca vazia do PDF, compilada quando o PDF está fora do build
// (desligado no `omnistyle.config.json` do app).
//
// O app gerado pelo React Native registra os componentes da lib com
// `NSClassFromString(@"OmniPdfView")` dentro de um dicionário: se a classe não
// existir, o app quebra ao abrir. Esta casca mantém o nome (sem PDFKit, sem Swift)
// e só desenha uma view vazia — o JS nem chega a renderizá-la com o módulo desligado.

#import <React/RCTViewComponentView.h>

#import <react/renderer/components/OmnistyleSpec/ComponentDescriptors.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface OmniPdfView : RCTViewComponentView
@end

@implementation OmniPdfView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<OmniPdfViewComponentDescriptor>();
}

@end

Class<RCTComponentViewProtocol> OmniPdfViewCls(void)
{
  return OmniPdfView.class;
}
