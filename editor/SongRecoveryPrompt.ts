// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { HTML } from "imperative-html/dist/esm/elements-strict";
import { nsLocalStorage_get } from "./namespaced_localStorage";
import { Prompt } from "./Prompt";
import { SongDocument } from "./SongDocument";
import { RecoveredSong, SongRecovery, versionToKey } from "./SongRecovery";

const { button, div, h2, p, select, option, iframe } = HTML;

export class SongRecoveryPrompt implements Prompt {
	private readonly _songContainer = div();
		private readonly _cancelButton = button({class: "cancelButton"});
		
		readonly container = div({class: "prompt", style: "width: 300px;"},
		h2("Song Recovery"),
			div({style: "max-height: 385px; overflow-y: auto;"},
			p("This is a TEMPORARY list of songs you have recently modified. Please keep your own backups of songs you care about! SONGS THAT USE SAMPLES WILL TAKE A WHILE TO LOAD, so be patient!"),
			this._songContainer,
			p("(If \"Display Song Data in URL\" is enabled in your preferences, then you may also be able to find song versions in your browser history. However, song recovery won't work if you were browsing in private/incognito mode.)"),
		),
		this._cancelButton,
	);
		
	constructor(private _doc: SongDocument) {
		this._cancelButton.addEventListener("click", this._close);
			
		const songs: RecoveredSong[] = SongRecovery.getAllRecoveredSongs();
			
		if (songs.length == 0) {
			this._songContainer.appendChild(p("There are no recovered songs available yet. Try making a song!"));
		}
			
		for (const song of songs) {
				const versionMenu = select({style: "width: 100%;"});
				
			for (const version of song.versions) {
				versionMenu.appendChild(option({ value: version.time }, version.name + ": " + new Date(version.time).toLocaleString()));
			}
				
				const player = iframe({style: "width: 100%; height: 60px; border: none; display: block;"});
			player.src = "player/" + (OFFLINE ? "index.html" : "") + "#song=" + nsLocalStorage_get(versionToKey(song.versions[0]));
				const container = div({style: "margin: 4px 0;"}, div({class: "selectContainer", style: "width: 100%; margin: 2px 0;"}, versionMenu), player);
			this._songContainer.appendChild(container);
				
			versionMenu.addEventListener("change", () => {
				const version = song.versions[versionMenu.selectedIndex];
				player.contentWindow!.location.replace("player/" + (OFFLINE ? "index.html" : "") + "#song=" + nsLocalStorage_get(versionToKey(version)));
				player.contentWindow!.dispatchEvent(new Event("hashchange"));
			});
		}
	}
		
		private _close = (): void => { 
		this._doc.undo();
	}
		
		cleanUp = (): void => { 
		this._cancelButton.removeEventListener("click", this._close);
	}
}