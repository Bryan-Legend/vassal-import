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
        var parts = text.split(/[;,]+/); // split by ; and ,

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
        for (const child of xml.querySelectorAll(":scope > " + CSS.escape("VASSAL.build.widget.BoxWidget"))) {
            await this.addActors(dataArray, child, folder);
        }

        for (const child of xml.querySelectorAll(":scope > " + CSS.escape("VASSAL.build.widget.PieceSlot"))) {
            var data = {
                type: "character",
                name: child.getAttribute("entryName"),
                img: this.extractImage(child.innerHTML),
                folder: folder.id,
            };
            var token = {
                width: child.getAttribute("width") / this.mapPixelsPerUnit,
                height: child.getAttribute("height") / this.mapPixelsPerUnit,
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

    addToken(dataArray, stack, token) {
        var data = {
            name: stack.getAttribute("name"),
            img: this.extractImage(token.innerHTML),
            x: parseFloat(stack.getAttribute("x")),
            y: parseFloat(stack.getAttribute("y")),
        };
        if (token.getAttribute("width") > 0) {
            data.width = token.getAttribute("width") / this.mapPixelsPerUnit;
        } else {
            if (stack.getAttribute("width") > 0)
                data.width = stack.getAttribute("width") / this.mapPixelsPerUnit;
        }
        if (token.getAttribute("height") > 0) {
            data.height = token.getAttribute("height") / this.mapPixelsPerUnit;
        } else {
            if (stack.getAttribute("height") > 0)
                data.height = stack.getAttribute("height") / this.mapPixelsPerUnit;
        }
        dataArray.push(data);
    }

    rgbToHex(color) {
        if (!color)
            return color;

        color = "" + color;
        if (color.charAt(0) == "#") {
            return color;
        }

        var nums = /(.*?)(\d+),\s*(\d+),\s*(\d+)/i.exec(color),
            r = parseInt(nums[2], 10).toString(16),
            g = parseInt(nums[3], 10).toString(16),
            b = parseInt(nums[4], 10).toString(16);

        return "#" + (
            (r.length == 1 ? "0" + r : r) +
            (g.length == 1 ? "0" + g : g) +
            (b.length == 1 ? "0" + b : b)
        );
    }

    getMeta(url) {
        return new Promise((resolve, reject) => {
            let img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject();
            img.src = url;
        });
    }

    async importScene(map) {
        console.log(map);

        var folder = await this.createOrGetFolder("Scene", this.adventure.name);
        var mapName = map.getAttribute("mapName");

        var data = { name: mapName, navigation: false, folder: folder.id, permission: { default: 3 }, tokenVision: false };
        var color = map.getAttribute("backgroundcolor");
        if (color && color != "255,255,255")
            data.backgroundColor = this.rgbToHex(color);

        // todo: create a scene for each image in this loop
        for (const board of map.querySelectorAll(CSS.escape("VASSAL.build.module.map.boardPicker.Board"))) {
            var image = board.getAttribute("image");
            if (image !== undefined && image !== null && !image.endsWith(".gif")) // todo: GIF image conversion
            {
                data.img = this.adventure.path + "/images/" + image;

                let img = await this.getMeta(data.img);
                data.width = img.width;
                data.height = img.height; 
            }

            var width = board.getAttribute("width");
            if (width > 0) {
                data.width = width;
            } else {
                if (!data.width)
                    data.width = 4000;
            }
            var height = board.getAttribute("height");
            if (height > 0) {
                data.height = height;
            } else {
                if (!data.height)
                    data.height = 3000;
            }

            break;
        }

        var existing = game.scenes.entities.find(m => m.name == mapName && m.folder == folder);
        if (existing) {
            await existing.delete();
        }

        let dataArray = [];
        for (const stack of map.querySelectorAll(CSS.escape("VASSAL.build.module.map.SetupStack"))) {
            for (const token of stack.querySelectorAll(CSS.escape("VASSAL.build.widget.PieceSlot"))) {
                this.addToken(dataArray, stack, token);
            }
        }

        for (const stack of map.querySelectorAll(CSS.escape("VASSAL.build.module.map.DrawPile"))) {
            for (const token of stack.querySelectorAll(CSS.escape("VASSAL.build.widget.CardSlot"))) {
                this.addToken(dataArray, stack, token);
            }
            for (const token of stack.querySelectorAll(CSS.escape("VASSAL.build.widget.PieceSlot"))) {
                this.addToken(dataArray, stack, token);
            }
        }
        for (var tokenData of dataArray) {
            tokenData.x += data.width * 0.25;
            tokenData.y += data.height * 0.25;

            if (tokenData.width <= 0)
                tokenData.width = null;
            if (tokenData.height <= 0)
                tokenData.height = null;
        }

        data.tokens = dataArray;

        console.log(`Creating Scene ${mapName} ` + data.img);
        var newScene = await Scene.create(data);
        console.log(data);
        console.log(newScene);
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
                    importFilename = form.data.files[0].name;
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

                CONFIG.VASSALIMPORT.TEMPORARY = {
                    folders: {},
                    import: {}
                };

                this.mapPixelsPerUnit = game.settings.get("vassal-import", "mapPixelsPerUnit");


                //var removeFolder = await this.createOrGetFolder("Actor", this.adventure.name);
                //await removeFolder.delete();
                //removeFolder = await this.createOrGetFolder("Scene", this.adventure.name);
                //await removeFolder.delete();

                if (game.settings.get("vassal-import", "extractFiles"))
                    await this._extractZip(zip, adventure);

                var parser = new DOMParser();

                if (zip.file("moduledata")) {
                    var module = parser.parseFromString(await zip.file("moduledata").async("text"), "text/xml");
                    //console.log(module);
                    adventure.name = module.querySelector("name").innerHTML;
                }
                console.log(adventure);

                var build = parser.parseFromString(await zip.file("buildFile").async("text"), "text/xml");

                //                CONFIG.VASSALIMPORT.LAST = build;

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
                for (const map of build.querySelectorAll(CSS.escape("VASSAL.build.module.PrivateMap"))) {
                    await this.importScene(map);
                }

                // TODO: Import audio

                // TODO: Import Dice
                // https://gitlab.com/riccisi/foundryvtt-dice-so-nice/-/wikis/API/Customization
                // 256x256 textures required

                //var prototypes = ["VASSAL.launch.BasicModule"]["VASSAL.build.module.PrototypesContainer"]["VASSAL.build.module.PrototypeDefinition"];
                //console.log(prototypes);

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

                CONFIG.VASSALIMPORT.TEMPORARY = {};
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

    _updateProgress(total, count, type) {
        const localizedType = `AIE.${type}`;
        $(".import-progress-bar").width(`${Math.trunc((count / total) * 100)}%`).html(`<span>${game.i18n.localize("AIE.Working")} (${game.i18n.localize(localizedType)})...</span>`);
    }
}