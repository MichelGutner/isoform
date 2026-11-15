# Os view managers dos módulos são criados por reflexão (OmnistylePackage):
# o R8 do app não pode remover nem renomear as classes nem o construtor vazio.
-keep class com.omnistyle.** extends com.facebook.react.uimanager.ViewManager {
  public <init>();
}
