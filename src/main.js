import VassalModuleImport from "./vassal-import.js";

CONFIG.VASSALIMPORT = {
    module: "Vassal Import",
    schemaVersion: "1.1"
}

Hooks.on('ready', () => {
    game.settings.registerMenu("vassal-import", "aieImporter", {
        name: "Vassal Import",
        label: "Vassal Importer (save settings before using)",
        hint: "Import data from vmod",
        icon: "fas fa-file-import",
        type: VassalModuleImport,
        restricted: true,
    });

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
    game.settings.register("vassal-import", "mapPixelsPerUnit", {
        name: "Map Pixels Per Unit",
        hint: "The grid size in pixels of the single unit tokens. Typically 64, 75, or 100. Used to size the tokens to the images.",
        scope: "world",
        config: true,
        default: "100",
        type: String
    });
    game.settings.register("vassal-import", "extractFiles", {
        name: "Extract Files",
        hint: "Extracts all of the files during the import. Turn this off to speed up repeat imports.",
        scope: "world",
        config: true,
        default: "true",
        type: Boolean
    });
});

