import Helpers from "./common.js";

export default class VassalModuleImport extends FormApplication {
    /** @override */
    static get defaultOptions() {
        this.pattern = /(\@[a-z]*)(\[)([a-z0-9]*|[a-z0-9\.]*)(\])(\{)(.*?)(\})/gmi
        this.altpattern = /((data-entity)="([a-zA-Z]*)"|(data-pack)="([[\S\.]*)") data-id="([a-zA-z0-9]*)">(.*)<\/a>/gmi

        return mergeObject(super.defaultOptions, {
            id: "vassal-import",
            classes: ["vassal-import"],
            title: "Vassal Importer",
            template: "modules/vassal-import/templates/import.html"
        });
    }

    /** @override */
    async getData() {
        const importpath = game.settings.get("vassal-import", "importpath");
        let data;
        let files = [];

        try {
            if (Helpers.verifyPath("data", importpath)) {
                data = await Helpers.BrowseFiles("data", importpath, { bucket: null, extensions: [".vmod", ".VMOD"], wildcard: false })
                files = data.files.map(file => {
                    const filename = decodeURIComponent(file).replace(/^.*[\\\/]/, '')

                    return { path: decodeURIComponent(file), name: filename }
                })
            }
        } catch (err) {
            Helpers.logger.error(`Unable to verify import path, this may be due to permissions on the server.`);
        }

        return {
            data,
            files,
            cssClass: "aie-importer-window"
        };

    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        html.find(".dialog-button").on("click", this._dialogButton.bind(this));
    }

    extractImage(text) {
        //sequenceDecode(source, delimiter) {
        //    var parts = text.split(delimiter);
        //}
        //var commandParts = sequenceDecode.split('/');
        //var typeParts = commandParts[2].split(';');
        //var state = commandParts[3];

        //console.log(text);
        //console.log(parts);

        // see https://github.com/vassalengine/vassal/blob/848c4b8c4d7ae7cadf9260ec6b42144616e58373/vassal-app/src/main/java/VASSAL/tools/SequenceEncoder.java
        // https://github.com/vassalengine/vassal/blob/848c4b8c4d7ae7cadf9260ec6b42144616e58373/vassal-app/src/main/java/VASSAL/build/module/BasicCommandEncoder.java
        // https://github.com/vassalengine/vassal/blob/848c4b8c4d7ae7cadf9260ec6b42144616e58373/vassal-app/src/main/java/VASSAL/command/AddPiece.java
        // usually ';' delimited, then ','
        // rarely ':' '|' '\t' '+' '~' 
        // commands use '/' first

        // +/null/prototype;Americas-encounter-template	emb2;Activate;2;;;2;;;2;;;;1;false;0;0;americas-text-A7.svg;TheText;false;CardText;;;false;;1;1;true;65,130;;\	piece;;;;Americas 07/	1\	null;0;0;607;0
        // Command Type +
        // Command target ID: null
        // Command Target getType(): prototype; Americas - encounter - template	emb2; Activate; 2;;; 2;;; 2;;;; 1; false; 0; 0; americas - text - A7.svg; TheText; false; CardText;;; false;; 1; 1; true; 65, 130;; \	piece;;;; Americas 07 
        // GetState(): C1\	null; 0; 0; 607; 0

        // for now we just skip all that shit and take the last that looks like an image.

        var image;
        var parts = text.split(';');

        // TODO: convert .gif to .png files FML
        // part.endsWith(".gif") ||

        if (Array.isArray(parts)) {
            parts.forEach(part => {
                if (part.endsWith(".png") || part.endsWith(".jpg") || part.endsWith(".jpeg") || part.endsWith(".svg")) {
                    image = this.adventure.path + "/images/" + part;
                };
            });
        }
        return image
    }

    async createOrGetFolder(type, name, parentFolder) {
        if (parentFolder === undefined) {
            parentFolder = null;
        }

        var result = await game.folders.entities.find(f => f.type == type && f.data.name == name && f.parent === parentFolder);
        //console.log(result);
        if (result === undefined) {
            console.log("Creating folder " + name + " in parent " + parentFolder?.name);
            var data = { name: name, type: type, parent: null };
            if (parentFolder !== null)
                data.parent = parentFolder.id;
            result = await Folder.create(data);
        }

        //console.log(result);
        return result;
    }

    async addActors(dataArray, xml, parentFolder = undefined) {
        //console.log(xml);
        if (parentFolder === undefined)
            parentFolder = await this.createOrGetFolder("Actor", this.adventure.name);

        var name = xml.getAttribute("name");
        if (!name)
            name = xml.getAttribute("entryName");

        var folder;
        if (!name || parentFolder.name == name)
            folder = parentFolder;
        else
            folder = await this.createOrGetFolder("Actor", name, parentFolder);

        for (const child of xml.querySelectorAll(":scope > " + CSS.escape("VASSAL.build.widget.PanelWidget"))) {
            await this.addActors(dataArray, child, folder);
        }
        for (const child of xml.querySelectorAll(":scope > " + CSS.escape("VASSAL.build.widget.TabWidget"))) {
            await this.addActors(dataArray, child, folder);
        }
        for (const child of xml.querySelectorAll(":scope > " + CSS.escape("VASSAL.build.widget.ListWidget"))) {
            await this.addActors(dataArray, child, folder);
        }

        // todo: add this as an option
        const mapPixelsPerUnit = 75;

        for (const child of xml.querySelectorAll(":scope > " + CSS.escape("VASSAL.build.widget.PieceSlot"))) {
            var data = {
                type: "character",
                name: child.getAttribute("entryName"),
                img: this.extractImage(child.innerHTML),
                folder: folder.id,
            };
            var token = {
                width: child.getAttribute("width") / mapPixelsPerUnit,
                height: child.getAttribute("height") / mapPixelsPerUnit,
            };

            if (token.width > 0 && token.height > 0) {
                data.token = token;
                //if (token.width != 1) {
                //    console.log(child.getAttribute("width"));
                //    console.log(mapPixelsPerUnit);
                //    console.log(token.width);
                //}
            }
            dataArray.push(data);
        }
    }

    async importScene(map) {
        //console.log(map);

        var folder = await this.createOrGetFolder("Scene", this.adventure.name);
        var mapName = map.getAttribute("mapName");
        var data = { name: mapName, active: true, navigation: false, folder: folder.id };

        for (const board of map.querySelectorAll(CSS.escape("VASSAL.build.module.map.boardPicker.Board"))) {
            // todo: create a scene for each image in this loop
            var width = board.getAttribute("width");
            if (width > 0)
                data.width = width;
            var height = board.getAttribute("height");
            if (height > 0)
                data.width = height;
            var color = board.getAttribute("color");
            data.color = color;

            var image = board.getAttribute("image");
            if (image !== undefined && image !== null && !image.endsWith(".gif")) // todo: GIF image conversion
                data.img = this.adventure.path + "/images/" + image;

            break;
        }

        var existing = game.scenes.entities.find(m => m.name == mapName && m.folder == folder);
        if (existing) {
            await existing.delete();
        }

        console.log(data);
        console.log(`Creating Scene ${mapName} ` + data.img);

        let newScene = await Scene.create(data);
        console.log(newScene);

        let dataArray = [];

        for (const stack of map.querySelectorAll(CSS.escape("VASSAL.build.module.map.SetupStack"))) {
            for (const token of stack.querySelectorAll(CSS.escape("VASSAL.build.widget.PieceSlot"))) {
                var data = {
                    scene: newScene,
                    name: stack.getAttribute("name"),
                    img: this.extractImage(token.innerHTML),
                    x: stack.getAttribute("x"),
                    y: stack.getAttribute("y"),
                };
                if (token.getAttribute("width") > 0)
                    data.width = token.getAttribute("width");
                if (token.getAttribute("height") > 0)
                    data.width = token.getAttribute("height");
                dataArray.push(data);
            }
        }

        for (const stack of map.querySelectorAll(CSS.escape("VASSAL.build.module.map.DrawPile"))) {
            for (const token of stack.querySelectorAll(CSS.escape("VASSAL.build.widget.PieceSlot"))) {
                var data = {
                    scene: newScene,
                    name: stack.getAttribute("name"),
                    img: this.extractImage(token.innerHTML),
                    x: stack.getAttribute("x"),
                    y: stack.getAttribute("y"),
                };
                if (token.getAttribute("width") > 0)
                    data.width = token.getAttribute("width");
                if (token.getAttribute("height") > 0)
                    data.width = token.getAttribute("height");
                dataArray.push(data);
            }
        }

        for (var data in dataArray) {
            if (data.width <= 0)
                data.width = null;
            if (data.height <= 0)
                data.height = null;
        }
        console.log(dataArray);

        await Token.create(dataArray);
    }

    async _dialogButton(event) {
        event.preventDefault();
        event.stopPropagation();
        const a = event.currentTarget;
        const action = a.dataset.button;

        if (action === "import") {
            let importFilename;
            try {
                $(".import-progress").toggleClass("import-hidden");
                $(".aie-overlay").toggleClass("import-invalid");

                const form = $("form.aie-importer-window")[0];

                let zip;
                if (form.data.files.length) {
                    zip = await Helpers.readBlobFromFile(form.data.files[0]).then(JSZip.loadAsync);
                } else {
                    const selectedFile = $("#import-file").val();
                    var split = selectedFile.split('/');
                    importFilename = split[split.length - 1];
                    zip = await fetch(`/${selectedFile}`)
                        .then(function (response) {
                            if (response.status === 200 || response.status === 0) {
                                return Promise.resolve(response.blob());
                            } else {
                                return Promise.reject(new Error(response.statusText));
                            }
                        })
                        .then(JSZip.loadAsync);
                }

                var adventure = { name: importFilename };
                this.adventure = adventure;
                adventure.path = `worlds/${game.world.name}/vassal/${(adventure.name).replace(/[^a-z0-9]/gi, '_')}`;

                CONFIG.AIE.TEMPORARY = {
                    folders: {},
                    import: {}
                }

                //var removeFolder = await this.createOrGetFolder("Actor", this.adventure.name);
                //await removeFolder.delete();
                //removeFolder = await this.createOrGetFolder("Scene", this.adventure.name);
                //await removeFolder.delete();

                // TODO: Add a flag to make extraction optional for dev
                await this._extractZip(zip, adventure);

                var parser = new DOMParser();

                if (zip.file("moduledata")) {
                    var module = parser.parseFromString(await zip.file("moduledata").async("text"), "text/xml");
                    //console.log(module);
                    adventure.name = module.querySelector("name").innerHTML;
                }
                console.log(adventure);

                var build = parser.parseFromString(await zip.file("buildFile").async("text"), "text/xml");

                //                CONFIG.AIE.LAST = build;

                console.log(build);

                for (const pieceWindow of build.querySelectorAll(CSS.escape("VASSAL.build.module.PieceWindow"))) {
                    let dataArray = [];
                    await this.addActors(dataArray, pieceWindow);
                    console.log(dataArray.length + " pieces found");
                    await Actor.create(dataArray);
                }

                for (const map of build.querySelectorAll(CSS.escape("VASSAL.build.module.Map"))) {
                    await this.importScene(map);
                }

                // TODO: Import audio

                // TODO: Import Dice
                // https://gitlab.com/riccisi/foundryvtt-dice-so-nice/-/wikis/API/Customization
                // 256x256 textures required

                //var prototypes = ["VASSAL.launch.BasicModule"]["VASSAL.build.module.PrototypesContainer"]["VASSAL.build.module.PrototypeDefinition"];
                //console.log(prototypes);

                //console.log(zip.folder("images"));
                //console.log(zip.folder("images").files);
                //console.log(zip.folder("images").files.length);
                //if (zip.folder("images").files.length > 0) {
                //    console.log("boop");
                //    Helpers.logger.debug(`${adventure.name} - Loading images`);
                //    await this._extractFolder("images", zip, adventure);
                //}

                //if (this._folderExists("fonts", zip)) {
                //    Helpers.logger.debug(`${adventure.name} - Loading fonts`);
                //    await this._extractFolder("fonts", zip, adventure);
                //}
                //if (this._folderExists("sounds", zip)) {
                //    Helpers.logger.debug(`${adventure.name} - Loading sounds`);
                //    await this._extractFolder("sounds", zip, adventure);
                //}


                //if (this._folderExists("scene", zip)) {
                //    Helpers.logger.debug(`${adventure.name} - Loading scenes`);
                //    await this._importFile("scene", zip, adventure, folders);
                //}
                //if (this._folderExists("actor", zip)) {
                //    Helpers.logger.debug(`${adventure.name} - Loading actors`);
                //    await this._importFile("actor", zip, adventure, folders);
                //}
                //if (this._folderExists("item", zip)) {
                //    Helpers.logger.debug(`${adventure.name} - Loading item`);
                //    await this._importFile("item", zip, adventure, folders);
                //}
                //if (this._folderExists("journal", zip)) {
                //    Helpers.logger.debug(`${adventure.name} - Loading journal`);
                //    await this._importFile("journal", zip, adventure, folders);
                //}
                //if (this._folderExists("table", zip)) {
                //    Helpers.logger.debug(`${adventure.name} - Loading table`);
                //    await this._importFile("table", zip, adventure, folders);
                //}
                //if (this._folderExists("playlist", zip)) {
                //    Helpers.logger.debug(`${adventure.name} - Loading playlist`);
                //    await this._importFile("playlist", zip, adventure, folders);
                //}
                //if (this._folderExists("compendium", zip)) {
                //    Helpers.logger.debug(`${adventure.name} - Loading compendium`);
                //    await this._importCompendium("compendium", zip, adventure, folders);
                //}
                //if (this._folderExists("macro", zip)) {
                //    Helpers.logger.debug(`${adventure.name} - Loading macro`);
                //    await this._importFile("macro", zip, adventure, folders);
                //}

                try {
                    if (this._itemsToRevisit.length > 0) {
                        let totalcount = this._itemsToRevisit.length;
                        let currentcount = 0;

                        await Helpers.asyncForEach(this._itemsToRevisit, async item => {
                            const to_timer = setTimeout(() => {
                                Helpers.logger.warn(`Reference update timed out.`);
                                const title = `Successful Import of ${adventure.name}`;
                                new Dialog(
                                    {
                                        title: title,
                                        content: {
                                            adventure
                                        },
                                        buttons: {
                                            two: {
                                                label: "Ok",
                                            },
                                        },
                                    },
                                    {
                                        classes: ["dialog", "vassal-import"],
                                        template: "modules/vassal-import/templates/import-complete.html",
                                    }
                                ).render(true);
                                this.close();
                            }, 60000)
                            try {
                                const obj = await fromUuid(item);
                                let rawData;
                                let updatedData = {};
                                switch (obj.entity) {
                                    case "Scene":
                                        // this is a scene we need to update links to all items 
                                        await Helpers.asyncForEach(obj.data.tokens, async token => {
                                            if (token.actorId) {
                                                const actor = Helpers.findEntityByImportId("actors", token.actorId);
                                                if (actor) {
                                                    await obj.updateEmbeddedEntity("Token", { _id: token._id, actorId: actor._id });
                                                }
                                            }
                                        });
                                        await Helpers.asyncForEach(obj.data.notes, async note => {
                                            if (note.entryId) {
                                                const journalentry = Helpers.findEntityByImportId("journal", note.entryId);
                                                if (journalentry) {
                                                    await obj.updateEmbeddedEntity("Note", { _id: note._id, entryId: journalentry._id });
                                                }
                                            }
                                        });
                                        let sceneJournal = Helpers.findEntityByImportId("journal", obj.data.journal);
                                        if (sceneJournal) {
                                            updatedData["journal"] = sceneJournal?._id;
                                        }
                                        let scenePlaylist = Helpers.findEntityByImportId("playlists", obj.data.playlist);
                                        if (scenePlaylist) {
                                            updatedData["playlist"] = scenePlaylist?._id;
                                        }
                                        await obj.update(updatedData);
                                        break;
                                    case "RollTable":
                                        updatedData = {
                                            results: obj.results
                                        }
                                        await Helpers.asyncForEach(obj.results, async (result, index) => {
                                            switch (result.type) {
                                                case 1:
                                                    let refType = "";
                                                    switch (result.collection.toLowerCase()) {
                                                        // this is a world obj, type denoted by collection 
                                                        case "scene":
                                                            refType = "scenes";
                                                            break;
                                                        case "journalentry":
                                                            refType = "journal";
                                                            break;
                                                        case "rolltable":
                                                            refType = "tables";
                                                            break;
                                                        case "actor":
                                                            refType = "actors";
                                                            break;
                                                        case "item":
                                                            refType = "items";
                                                            break;
                                                    }
                                                    let rolltableresultitem = Helpers.findEntityByImportId(refType, result.resultId);
                                                    if (rolltableresultitem) {
                                                        updatedData.results[index].resultId = rolltableresultitem?._id;
                                                    }
                                                    break;
                                                case 2:
                                                    // this is a compendium obj, pack denoted by collection
                                                    const pack = await game.packs.get(obj.data.collection);
                                                    if (!pack.locked && !pack.private) {
                                                        let content = await pack.getContent();

                                                        let compendiumItem = content.find(contentItem => {
                                                            return contentItem.data.flags.importid === obj.data.resultId;
                                                        });

                                                        if (compendiumItem) {
                                                            updatedData.results[index].resultId = compendiumItem.data._id;
                                                        }
                                                    }
                                                    break;
                                                default:
                                                // this is straight text
                                            }
                                        });

                                        break;
                                    default:
                                        // this is where there is reference in one of the fields
                                        rawData = JSON.stringify(obj.data);
                                        const pattern = /(\@[a-z]*)(\[)([a-z0-9]*|[a-z0-9\.]*)(\])(\{)(.*?)(\})/gmi
                                        const altpattern = /((data-entity)=\\\"([a-zA-Z]*)\\\"|(data-pack)=\\\"([[\S\.]*)\\\") data-id=\\\"([a-zA-z0-9]*)\\\">(.*?)<\/a>/gmi

                                        const referenceUpdater = async (match, p1, p2, p3, p4, p5, p6, p7, offset, string) => {
                                            let refType;
                                            switch (p1.replace(/\@/, "").toLowerCase()) {
                                                case "scene":
                                                    refType = "scenes";
                                                    break;
                                                case "journalentry":
                                                    refType = "journal";
                                                    break;
                                                case "rolltable":
                                                    refType = "tables";
                                                    break;
                                                case "actor":
                                                    refType = "actors";
                                                    break;
                                                case "item":
                                                    refType = "items";
                                                    break;
                                            }

                                            let newObj = { _id: p3 }

                                            if (p1 !== "@Compendium") {
                                                let nonCompendiumItem = Helpers.findEntityByImportId(refType, p3);
                                                if (nonCompendiumItem) {
                                                    newObj = nonCompendiumItem;
                                                }
                                            } else {
                                                newObj = { _id: p3 };
                                                const [p, name, entryid] = p3.split(".");
                                                try {
                                                    const pack = await game.packs.get(`${p}.${name}`);
                                                    if (!pack.locked && !pack.private) {
                                                        let content = await pack.getContent();

                                                        let compendiumItem = content.find(contentItem => {
                                                            return contentItem.data.flags.importid === entryid;
                                                        });

                                                        if (!compendiumItem) {
                                                            await pack.getIndex();
                                                            compendiumItem = pack.index.find(e => e.name === p6);
                                                            if (compendiumItem) {
                                                                newObj["_id"] = `${p}.${name}.${compendiumItem._id}`;
                                                            }
                                                        } else {
                                                            newObj["_id"] = `${p}.${name}.${compendiumItem.data._id}`;
                                                        }
                                                    }
                                                } catch (err) {
                                                    Helpers.logger.warn(`Unable to find find compendium item ${match} to fix link.  If the compendium referenced is part of the system, this warning can be ignored, otherwise please make sure compendiums are unlocked and visible during import.`, err);
                                                }
                                            }

                                            return [p1, p2, newObj._id, p4, p5, p6, p7].join("");
                                        }

                                        const altReferenceUpdater = async (match, p1, p2, p3, p4, p5, p6, p7, offset, string) => {
                                            console.log(match);
                                            let refType;
                                            let newObj = { _id: p6 };
                                            if (p2 && p2.toLowerCase() === "data-entity") {
                                                switch (p3.toLowerCase()) {
                                                    case "scene":
                                                        refType = "scenes";
                                                        break;
                                                    case "journalentry":
                                                        refType = "journal";
                                                        break;
                                                    case "rolltable":
                                                        refType = "tables";
                                                        break;
                                                    case "actor":
                                                        refType = "actors";
                                                        break;
                                                    case "item":
                                                        refType = "items";
                                                        break;
                                                }
                                                let nonCompendiumItem = Helpers.findEntityByImportId(refType, p6);
                                                if (nonCompendiumItem) {
                                                    newObj = nonCompendiumItem;
                                                } else {
                                                    Helpers.logger.warn(`Unable to find item ${match} to fix link.`);
                                                }
                                            } else if (p4.toLowerCase() === "data-pack") {
                                                try {
                                                    const pack = await game.packs.get(p5);
                                                    if (!pack.locked && !pack.private) {
                                                        let content = await pack.getContent();

                                                        let compendiumItem = content.find(contentItem => {
                                                            return contentItem.data.flags.importid === p6;
                                                        });

                                                        if (!compendiumItem) {
                                                            await pack.getIndex();
                                                            compendiumItem = pack.index.find(e => e.name === p7);
                                                            if (compendiumItem) {
                                                                newObj["_id"] = compendiumItem._id;
                                                            }
                                                        } else {
                                                            newObj["_id"] = compendiumItem.data._id;
                                                        }
                                                    }
                                                } catch (err) {
                                                    Helpers.logger.warn(`Unable to find compendium item ${match} to fix link.  If the compendium referenced is part of the system, this warning can be ignored, otherwise please make sure compendiums are unlocked and visible during import.`, err);
                                                }

                                                console.log(`Replacing ${p6} with ${newObj._id} for ${p7}`);
                                                return [p1, " data-id='", newObj._id, "'>", p7, "</a>"].join("");
                                            }
                                        }

                                        const updatedRawData = await Helpers.replaceAsync(rawData, pattern, referenceUpdater);
                                        const secondPassRawData = await Helpers.replaceAsync(updatedRawData, altpattern, altReferenceUpdater);
                                        const updatedDataUpdates = JSON.parse(secondPassRawData);
                                        const diff = Helpers.diff(obj.data, updatedDataUpdates);

                                        if (diff.items && obj.entity === "Actor" && diff.items.length > 0) {
                                            // the object has embedded items that need to be updated seperately.

                                            for (let i = 0; i < updatedDataUpdates.items.length; i += 1) {
                                                if (diff.items[i] && Object.keys(diff.items[i].data).length > 0) {
                                                    const itemUpdateDate = Helpers.buildUpdateData({ data: diff.items[i].data });

                                                    if (Object.keys(itemUpdateDate).length > 0) {
                                                        Helpers.logger.debug(`Updating Owned item ${updatedDataUpdates.items[i]._id} for ${item} with: `, itemUpdateDate)
                                                        await obj.updateEmbeddedEntity("OwnedItem", { _id: updatedDataUpdates.items[i]._id, ...itemUpdateDate });
                                                    }
                                                }
                                            }
                                        }
                                        delete diff.items;

                                        Helpers.logger.debug(`Updating object ${item}`, diff);

                                        updatedData = Helpers.buildUpdateData(diff);

                                        await obj.update(updatedData);
                                }
                            } catch (err) {
                                Helpers.logger.warn(`Error updating references for object ${item}`, err);
                            }
                            currentcount += 1;
                            this._updateProgress(totalcount, currentcount, "References");
                            clearTimeout(to_timer);
                        });
                    }
                } catch (err) {
                    Helpers.logger.warn(`Error during reference update for object ${item}`, err);
                }

                $(".aie-overlay").toggleClass("import-invalid");

                const title = `Successful Import of ${adventure.name}`;
                new Dialog(
                    {
                        title: title,
                        content: {
                            adventure
                        },
                        buttons: {
                            two: {
                                label: "Ok",
                            },
                        },
                    },
                    {
                        classes: ["dialog", "vassal-import"],
                        template: "modules/vassal-import/templates/import-complete.html",
                    }
                ).render(true);

                CONFIG.AIE.TEMPORARY = {}
                this.close();
            } catch (err) {
                $(".aie-overlay").toggleClass("import-invalid");
                ui.notifications.error(`There was an error importing ${importFilename}`);
                Helpers.logger.error(`Error importing file ${importFilename}`, err);
                this.close();
            }
        }
    }

    _folderExists(folder, zip) {
        //return zip.folder(folder).length > 0); {
        //    // Folder exists
        //} else {
        //    // Folder doesn't exist
        //}
        const files = Object.values(zip.files).filter(file => {
            return file.dir && file.name.toLowerCase().includes(folder)
        });

        return files.length > 0;
    }

    _getFiles(folder, zip) {
        const files = Object.values(zip.files).filter(file => {
            return !file.dir && file.name.split('.').pop() === 'json' && file.name.includes(`${folder}/`);
        })

        return files;
    }

    async _extractZip(zip, adventure) {
        const files = Object.values(zip.files).filter(file => {
            return !file.dir;
        })

        Helpers.logger.log(`Extracting ${adventure.name} (${files.length} items)`);
        await Helpers.asyncForEach(files, async (file) => {
            await Helpers.importImage(file.name, zip, adventure);
        });
    }

    async _extractFolder(folder, zip, adventure) {
        const files = Object.values(zip.files).filter(file => {
            return !file.dir && file.name.includes(`${folder}/`);
        })

        Helpers.logger.log(`Extracting ${adventure.name} - ${folder} (${files.length} items)`);
        await Helpers.asyncForEach(files, async (file) => {
            await Helpers.importImage(file.name, zip, adventure);
        });
    }

    _itemsToRevisit = [];

    async _importCompendium(type, zip, adventure) {
        let totalcount = 0;
        let currentcount = 0;
        const typeName = type[0].toUpperCase() + type.slice(1);
        const dataFiles = this._getFiles(type, zip);
        Helpers.logger.log(`Importing ${adventure.name} - ${typeName} (${dataFiles.length} items)`);
        totalcount = dataFiles.length;

        await Helpers.asyncForEach(dataFiles, async (file) => {
            const rawdata = await zip.file(file.name).async("text");
            const data = JSON.parse(rawdata);

            let pack = await Helpers.getCompendiumPack(data.info.entity, data.info.label);
            await pack.getIndex();

            totalcount += data.items.length;
            await Helpers.asyncForEach(data.items, async (item) => {
                let obj;
                let entry = pack.index.find(e => e.name === item.name);

                item.flags.importid = item._id;

                if (item.img) {
                    item.img = await Helpers.importImage(item.img, zip, adventure);
                }
                if (item.thumb) {
                    item.thumb = await Helpers.importImage(item.thumb, zip, adventure);
                }
                if (item?.token?.img) {
                    item.token.img = await Helpers.importImage(item.token.img, zip, adventure);
                }

                if (item?.items?.length) {
                    await Helpers.asyncForEach(data.items, async i => {
                        if (i.img) {
                            i.img = await Helpers.importImage(i.img, zip, adventure);
                        }
                    });
                }

                switch (data.info.entity) {
                    case "Item":
                        obj = new Item(item, { temporary: true });
                        break;
                    case "Actor":
                        obj = new Actor(item, { temporary: true });
                        break;
                    case "Scene":
                        obj = new Scene(item, { temporary: true });
                        break;
                    case "JournalEntry":
                        obj = new JournalEntry(item, { temporary: true });
                        break;
                    case "Macro":
                        obj = new Macro(item, { temporary: true });
                        break;
                    case "RollTable":
                        await Helpers.asyncForEach(item.results, async (result) => {
                            result.img = await Helpers.importImage(result.img, zip, adventure);
                        })
                        obj = new RollTable(item, { temporary: true });
                        break;
                    case "Playlist":
                        await Helpers.asyncForEach(item.sounds, async (sound) => {
                            sound.path = await Helpers.importImage(sound.path, zip, adventure);
                        });
                        obj = new Playlist(item, { temporary: true })
                        break;
                }

                if (!entry) {
                    let compendiumItem = await pack.importEntity(obj);

                    //let pattern = /(\@[a-z]*)(\[)([a-z0-9]*|[a-z0-9\.]*)(\])/gmi

                    if (JSON.stringify(item).match(this.pattern) || JSON.stringify(item).match(this.altpattern)) {
                        this._itemsToRevisit.push(`Compendium.${pack.metadata.package}.${pack.metadata.name}.${compendiumItem.data._id}`);
                    }
                }
                currentcount += 1;
                this._updateProgress(totalcount, currentcount, typeName);
            });
            currentcount += 1;
            this._updateProgress(totalcount, currentcount, typeName);
        });
    }

    async _importFile(type, zip, adventure, folders) {
        let totalcount = 0;
        let currentcount = 0;
        let folderMap = {};

        const typeName = type[0].toUpperCase() + type.slice(1);
        let importType = typeName;

        // handle the compound word, were we only pass single.
        importType = type === "journal" ? "JournalEntry" : importType;
        importType = type === "table" ? "RollTable" : importType;

        const dataFiles = this._getFiles(type, zip);

        Helpers.logger.log(`Importing ${adventure.name} - ${typeName} (${dataFiles.length} items)`);

        totalcount = dataFiles.length;

        await Helpers.asyncForEach(dataFiles, async (file) => {
            const rawdata = await zip.file(file.name).async("text");
            const data = JSON.parse(rawdata);

            let needRevisit = false;

            //let pattern = /(\@[a-z]*)(\[)([a-z0-9]*|[a-z0-9\.]*)(\])/gmi
            if (rawdata.match(this.pattern) || rawdata.match(this.altpattern)) {
                needRevisit = true;
            }

            if (data.img) {
                data.img = await Helpers.importImage(data.img, zip, adventure);
            }
            if (data.thumb) {
                data.thumb = await Helpers.importImage(data.thumb, zip, adventure);
            }
            if (data?.token?.img) {
                if (data?.token?.randomImg) {
                    const imgFilepaths = data.token.img.split("/");
                    const imgFilename = (imgFilepaths.reverse())[0];
                    const imgFilepath = data.token.img.replace(imgFilename, "");

                    const filesToUpload = Object.values(zip.files).filter((file) => {
                        return !file.dir && file.name.includes(imgFilepath);
                    });

                    let adventurePath = (adventure.name).replace(/[^a-z0-9]/gi, '_');

                    data.token.img = `worlds/${game.world.id}/vassal/${adventurePath}/${data.token.img}`

                    if (filesToUpload.length > 0) {
                        totalcount += filesToUpload.length;

                        await Helpers.asyncForEach(filesToUpload, async file => {
                            await Helpers.importImage(file.name, zip, adventure);
                            currentcount += 1;
                            this._updateProgress(totalcount, currentcount, importType);
                        });
                    }

                } else {
                    data.token.img = await Helpers.importImage(data.token.img, zip, adventure);
                }
            }

            if (data?.items?.length) {
                await Helpers.asyncForEach(data.items, async item => {
                    if (item.img) {
                        item.img = await Helpers.importImage(item.img, zip, adventure);
                    }
                });
            }

            if (typeName === "Playlist") {
                await Helpers.asyncForEach(data.sounds, async (sound) => {
                    if (sound.path) {
                        sound.path = await Helpers.importImage(sound.path, zip, adventure);
                    }
                });
            }
            if (typeName === "Table") {
                await Helpers.asyncForEach(data.results, async (result) => {
                    if (result.img) {
                        result.img = await Helpers.importImage(result.img, zip, adventure);
                    }
                    if (result.resultId) {
                        needRevisit = true;
                    }
                })
            }

            data.flags.importid = data._id;

            if (typeName !== "Playlist" && typeName !== "Compendium") {
                if (CONFIG.AIE.TEMPORARY.folders[data.folder]) {
                    Helpers.logger.debug(`Adding data to subfolder importkey = ${data.folder}, folder = ${CONFIG.AIE.TEMPORARY.folders[data.folder]}`);
                    data.folder = CONFIG.AIE.TEMPORARY.folders[data.folder];
                } else {
                    Helpers.logger.debug(`Adding data to subfolder importkey = ${data.folder}, folder = ${CONFIG.AIE.TEMPORARY.folders["null"]}`);
                    if (adventure?.options?.folders) {
                        data.folder = CONFIG.AIE.TEMPORARY.folders["null"];
                    } else {
                        data.folder = CONFIG.AIE.TEMPORARY.folders[importType];
                    }
                }
            }

            let id;

            switch (typeName) {
                case "Scene":
                    if (!Helpers.findEntityByImportId("scenes", data._id)) {
                        await Helpers.asyncForEach(data.tokens, async token => {
                            token.img = await Helpers.importImage(token.img, zip, adventure);
                        })

                        await Helpers.asyncForEach(data.sounds, async sound => {
                            sound.path = await Helpers.importImage(sound.path, zip, adventure);
                        })

                        await Helpers.asyncForEach(data.notes, async note => {
                            note.icon = await Helpers.importImage(note.icon, zip, adventure);
                        })

                        await Helpers.asyncForEach(data.tiles, async tile => {
                            tile.img = await Helpers.importImage(tile.img, zip, adventure);
                        })

                        let scene = await Scene.create(data);
                        this._itemsToRevisit.push(`Scene.${scene.data._id}`)
                    }
                    break;
                case "Actor":
                    if (!Helpers.findEntityByImportId("actors", data._id)) {
                        let actor = await Actor.create(data);
                        await actor.update({ [`data.token.actorId`]: actor.data._id })
                        if (needRevisit) {
                            this._itemsToRevisit.push(`Actor.${actor.data._id}`);
                        }
                    }
                    break;
                case "Item":
                    if (!Helpers.findEntityByImportId("items", data._id)) {
                        let item = await Item.create(data);
                        if (needRevisit) {
                            this._itemsToRevisit.push(`Item.${item.data._id}`);
                        }
                    }
                    break;
                case "Journal":
                    if (!Helpers.findEntityByImportId("journal", data._id)) {
                        let journal = await JournalEntry.create(data);
                        if (needRevisit) {
                            this._itemsToRevisit.push(`JournalEntry.${journal.data._id}`);
                        }
                    }
                    break;
                case "Table":
                    if (!Helpers.findEntityByImportId("tables", data._id)) {
                        let rolltable = await RollTable.create(data);
                        if (needRevisit) {
                            this._itemsToRevisit.push(`RollTable.${rolltable.data._id}`);
                        }
                    }
                    break;
                case "Playlist":
                    if (!Helpers.findEntityByImportId("playlists", data._id)) {
                        data.name = `${adventure.name}.${data.name}`;
                        await Playlist.create(data);
                    }
                    break;
                case "Macro":
                    if (!Helpers.findEntityByImportId("macros", data._id)) {
                        let macro = await Macro.create(data);
                        if (needRevisit) {
                            this._itemsToRevisit.push(`Macro.${macro.data._id}`);
                        }
                    }
                    break;
            }

            currentcount += 1;
            this._updateProgress(totalcount, currentcount, importType);
        });


    }

    _updateProgress(total, count, type) {
        const localizedType = `AIE.${type}`;
        $(".import-progress-bar").width(`${Math.trunc((count / total) * 100)}%`).html(`<span>${game.i18n.localize("AIE.Working")} (${game.i18n.localize(localizedType)})...</span>`);
    }
}