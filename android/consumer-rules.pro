# Os view managers dos módulos são criados por reflexão (IsoformPackage):
# o R8 do app não pode remover nem renomear as classes nem o construtor vazio.
-keep class com.isoform.** extends com.facebook.react.uimanager.ViewManager {
  public <init>();
}

# TurboModules of the modules (IsoImageModule…) are created by reflection too, with the React context.
-keep class com.isoform.** extends com.facebook.react.bridge.BaseJavaModule {
  public <init>(com.facebook.react.bridge.ReactApplicationContext);
}
