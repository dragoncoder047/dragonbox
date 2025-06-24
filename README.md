# DragonBox

DragonBox is an online tool for sketching and sharing instrumental music.
You can find it [here](https://dragoncoder047.github.io/dragonbox).
It is a fork of [Theepbox](https://github.com/Theepicosity/Theepbox), which is a fork of [Slarmoo's Box](https://github.com/slarmoo/slarmoosbox/), which is a fork of [Ultrabox](https://github.com/ultraabox/ultrabox_typescript), which is a fork of [JummBox](https://github.com/jummbus/jummbox), which is a fork of the [original BeepBox](https://github.com/johnnesky/beepbox) (whew!).

All song data is packaged into the URL at the top of your browser. When you make
changes to the song, the URL is updated to reflect your changes. When you are
satisfied with your song, just copy and paste the URL to save and share your
song!

DragonBox, as well as the beepmods which it's based on, are free projects. If you ever feel so inclined, please support the original creator, [John Nesky](http://www.johnnesky.com/), via
[PayPal](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=QZJTX9GRYEV9N&currency_code=USD)!

## Compiling

The compilation procedure is identical to the repository for BeepBox:

The source code is available under the MIT license. The code is written in
[TypeScript](https://www.typescriptlang.org/), which requires
[node & npm](https://www.npmjs.com/get-npm), so install those first. Then to
build this project, open a command line ([Git Bash](https://gitforwindows.org/)) and run:

```sh
git clone https://github.com/dragoncoder047/dragonbox.git
cd DragonBox
npm install
npm run build
```

JummBox (and by extension, DragonBox) makes a divergence from BeepBox that necessitates an additional dependency: rather than using the (rather poor) default HTML select implementation, the custom library [select2](https://select2.org) is employed. select2 has an explicit dependency on [jQuery](https://jquery.com) as well, so you may need to install the following additional dependencies if they are not picked up automatically (they usually are though).

```sh
npm install select2
npm install @types/select2
npm install @types/jquery
```

You can also use [pnpm](https://pnpm.io) for installing dependencies and running the build scripts above and below as well. Just substitute `pnpm` for `npm` everywhere.

## Code

The code is divided into several folders. This architecture is identical to BeepBox's.

The [synth/](synth) folder has just the code you need to be able to play DragonBox
songs out loud, and you could use this code in your own projects, like a web
game. After compiling the synth code, open website/synth_example.html to see a
demo using it. To rebuild just the synth code, run:

```sh
npm run build-synth
```

The [editor/](editor) folder has additional code to display the online song
editor interface. After compiling the editor code, open website/index.html to
see the editor interface. To rebuild just the editor code, run:

```sh
npm run build-editor
```

The [player/](player) folder has a miniature song player interface for embedding
on other sites. To rebuild just the player code, run:

```sh
npm run build-player
```

The [website/](website) folder contains index.html files to view the interfaces.
The build process outputs JavaScript files into this folder.

## Dependencies

Most of the dependencies are listed in [package.json](package.json), although there is an indirect, optional dependency on
[lamejs](https://www.npmjs.com/package/lamejs) via
[jsdelivr](https://www.jsdelivr.com/) for exporting .mp3 files. If the user
attempts to export an .mp3 file, the browser will try to download that dependency on demand.
Additionally, random envelopes rely on [js-xxhash](https://npmjs.com/package/js-xxhash) for fast hashing.

## Offline version

If you'd like to BUILD the offline version, enter the following into the command line of your choice:

```sh
npm run build-offline
```

After building, you can then enter the following to run it for testing purposes:

```sh
npm run start
```

And to package, run (do `npm run package-host` for your host platform; you may need to run git bash as an administrator for non-host platforms):

```sh
npm run package
```
