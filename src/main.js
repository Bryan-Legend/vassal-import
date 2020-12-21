import VassalModuleImport from "./vassal-import.js";
//import AdventureModuleExport from "./adventure-export.js";

CONFIG.AIE =  {
  module : "Vassal Import",
  schemaVersion : "1.1"
}

Hooks.on('ready', () => {
  // Importer Control Menu
  game.settings.registerMenu("vassal-import", "aieImporter", {
    name: "Vassal Import",
    label: "Vassal Importer",
    hint: "Import data from exported adventure",
    icon: "fas fa-file-import",
    type: VassalModuleImport,
    restricted: true,
  });

  //game.settings.register("vassal-import", "aieExporter", {
  //  name: "Adventure Exporter",
  //  scope: "world",
  //  default: {},
  //  config: false,
  //  default: {},
  //  type: Object,
  //});

  //game.settings.registerMenu("vassal-import", "aieExporter", {
  //  name: "Adventure Exporter",
  //  label: "Adventure Exporter",
  //  hint: "Export data to adventure file",
  //  icon: "fas fa-file-export",
  //  type: AdventureModuleExport,
  //  restricted: true,
  //});

  game.settings.register("vassal-import", "aieImporter", {
    name: "Vassal Importer",
    scope: "world",
    default: {},
    config: false,
    default: {},
    type: Object,
  });

  game.settings.register("vassal-import", "importpath", {
		name: "Import Path (Data/)",
		hint: "Location where the module will look for Vassal vmod files to import",
		scope: "world",
		config: true,
		default: "adventures/import",
		type: String
	});
	
});

