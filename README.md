# Vassal Board Game Module Importer for Foundry VTT

A module for importing Vassal board game modules into http://foundryvtt.com/.

**MANIFEST URL: https://raw.githubusercontent.com/Bryan-Legend/vassal-import/master/module.json**

Foundry Gaming, LLC has declined to include this module in the official module listing service, so you will need to manually add it.

There are **over Vassal 2,600 board game modules freely available at https://vassalengine.org/wiki/Category:Modules**. Vassal modules generally have the consent of the board game publishers to exist. Many board game publishers (including Avalon Hill, Gloomhaven, and Fantasy Flight Games) have very friendly policies towards VTT usage, unlike some other greedy corporations that we all know about.

#### [Dominion](https://vassalengine.org/wiki/Module:Dominion)
![Dominion](img/Dominion.png)

#### [Gloomhaven](https://vassalengine.org/wiki/Module:Gloomhaven)
![Gloomhaven](img/Gloomhaven.png)

#### [Terraforming Mars](https://vassalengine.org/wiki/Module:Terraforming_Mars)
![Terraforming Mars](img/TerraformingMars.jpg)

#### [Twilight Struggle](https://vassalengine.org/wiki/Module:Twilight_Struggle)
![Twilight Struggle](img/TwilightStruggle.png)

This module has been updated to support the new official foundry card system. (https://foundryvtt.com/article/cards/)

## How To Use

To import a file, first install the module and go to the module settings to set an import path within the data location.  If you click `Vassal Import` this will create the folder location on the server where you can place the vassal file.  Place the file in the folder and go back to the module settings (you may have to close the settings and reopen for the module to populate the file selector dropdown).  Select the file to import and click import.

![Usage](img/Usage.JPG)

## WARNING

Importing will create a scene and actor folder of the name of the module.
In order for the import to be re-runnable the existing scenes in the import scene folder will be deleted.
Re-running an import will double deck card collections, actors, and journals. So you may need to clear those out before you re-run an import.

![Settings](img/Settings.jpg)

Foundry defaults to 100px grid images. Some Vassal modules image sets are designed for a 64 pixel grid. Some are set to 75px. You'll need to select that as an option, or maybe you could set it on the scenes.

## Recommended Module

* Moar Folders (https://github.com/KayelGee/moar-folders) - Actor imports are often several levels deep and Foundry has an arbitrary limitation of 3 folder depth. Six seems to be enough. The data will import correctly but once you pass 3 folders it will start spamming the root folder heavily. Turning on this mod will fix.

## Todo

* Convert to typescript
* Dice So Nice integration
* Dice Tray integration
* .vsav file format import for better scene data
* prototype import for better token data
* gif image conversion to webp since foundry does not support gifs at all
* playlist generator for audio
* Use extracted fonts somehow
* Add a scene for each map picker option.
* Import grid config data.
