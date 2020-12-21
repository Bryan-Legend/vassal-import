# Vassal Import

A module for importing Vassal Board Game VMod files into Foundry.

There are over 2000 board games available at http://www.vassalengine.org/wiki/Category:Modules.

**MANIFEST URL: https://raw.githubusercontent.com/Bryan-Legend/vassal-import/master/module.json**

### Screenshots

Imperial Assault - http://www.vassalengine.org/wiki/Module:Star_Wars:_Imperial_Assault

Gloomhaven - http://www.vassalengine.org/wiki/Module:Gloomhaven
![Gloomhaven](img/Gloomhaven.PNG)

Terraforming Mars - http://www.vassalengine.org/wiki/Module:Terraforming_Mars

Go - http://www.vassalengine.org/wiki/Module:Go

Twilight Imperium - http://www.vassalengine.org/wiki/Module:Twilight_Imperium_(third_Edition)

Twilight Struggle - http://www.vassalengine.org/wiki/Module:Twilight_Struggle

Arkham Horror - http://www.vassalengine.org/wiki/Module:Arkham_Horror

## How To Use:

### Import

To import a file, first install the module and go to the module settings to set an import path within the data location.  If you click `Vassal Import` this will create the folder location on the server where you can place the vassal file.  Place the file in the folder and go back to the module settings (you may have to close the settings and reopen for the module to populate the file selector dropdown).  Select the file to import and click import.  The module will create all assets within the adventure (scenes, actors, and playlists), and all images/sounds included as well.

## Important Notes

Importing will create a scene and actor folder of the name of the module.
In order for the import to be re-runnable the existing scenes in the import scene folder will be deleted.

Foundry defaults to 100px grid images. Some Vassal modules image sets are designed for a 64 pixel grid. Some are set to 75px. You'll need to select that as an option, which hasn't been added yet. Or maybe you could set it on the scenes.

This module code base was originally from Adventure Import Export (https://github.com/cstadther/adventure-import-export).

## Recommended Modules

* Moar Folders (https://github.com/KayelGee/moar-folders) - Actor imports are often many levels deep and Foundry has a limitation of 3 folder depth. Six seems to be enough. The data will import correctly but once you pass 3 folders it will start spamming the root folder heavily. Turning on this mod will fix.

## Todo

* Pixel scale option
* Status progress bar updates
* Dice so Nice integration
* Cards Support integration
* .vsav file format import for better scene data
* prototype import for better scene data
* gif image conversion to webp since foundry does not support gif at all
* image size extraction for better token sizing
* playlist generator
* maybe use extracted fonts somehow
* Recommend a default game system. Maybe do some stat importing or something.
* a toggle for unzipping files (mostly as a dev option)
* macro importing (lol)
* direct downloading vmods via url.
