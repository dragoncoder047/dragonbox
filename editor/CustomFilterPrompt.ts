// Copyright (C) 2020 John Nesky, distributed under the MIT license.

import { HTML, SVG } from "imperative-html/dist/esm/elements-strict";
import { Effect } from "../synth/Effect";
import { FilterSettings } from "../synth/Filter";
import { Config } from "../synth/SynthConfig";
import { ColorConfig } from "./ColorConfig";
import { FilterEditor } from "./FilterEditor";
import { nsLocalStorage_get, nsLocalStorage_save } from "./namespaced_localStorage";
import { Prompt } from "./Prompt";
import { SongDocument } from "./SongDocument";
import { SongEditor } from "./SongEditor";

//namespace beepbox {
const { button, div, h2, p } = HTML;

export class CustomFilterPrompt implements Prompt {

    filterEditor: FilterEditor;

    filterData = new FilterSettings;
    startingFilterData = new FilterSettings;

    private _subfilterIndex = 0;

    readonly _playButton = button({ style: "width: 55%;", type: "button" });

    readonly _filterButtons: HTMLButtonElement[] = [];

    readonly _filterButtonContainer = div({ class: "instrument-bar", style: "justify-content: center;" });

    private readonly _cancelButton = button({ class: "cancelButton" });
    private readonly _okayButton = button({ class: "okayButton", style: "width:45%;" }, "Okay");

    private readonly _filterContainer = div({ style: "width: 100%; display: flex; flex-direction: row; align-items: center; justify-content: center;" });

    private readonly _editorTitle = div({}, h2("Edit Filter"));

    private readonly _filterCopyButton = button({ style: "width:86px; margin-right: 5px;", class: "copyButton" }, [
        "Copy",
        // Copy icon:
        SVG.svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-5 -21 26 26" }, [
            SVG.path({ d: "M 0 -15 L 1 -15 L 1 0 L 13 0 L 13 1 L 0 1 L 0 -15 z M 2 -1 L 2 -17 L 10 -17 L 14 -13 L 14 -1 z M 3 -2 L 13 -2 L 13 -12 L 9 -12 L 9 -16 L 3 -16 z", fill: "currentColor" }),
        ]),
    ]);
    private readonly _filterPasteButton = button({ style: "width:86px;", class: "pasteButton" }, [
        "Paste",
        // Paste icon:
        SVG.svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "0 0 26 26" }, [
            SVG.path({ d: "M 8 18 L 6 18 L 6 5 L 17 5 L 17 7 M 9 8 L 16 8 L 20 12 L 20 22 L 9 22 z", stroke: "currentColor", fill: "none" }),
            SVG.path({ d: "M 9 3 L 14 3 L 14 6 L 9 6 L 9 3 z M 16 8 L 20 12 L 16 12 L 16 8 z", fill: "currentColor", }),
        ]),
    ]);
    private readonly _filterCopyPasteContainer = div({ style: "width: 185px;" }, this._filterCopyButton, this._filterPasteButton);

    private readonly _filterCoordinateText = div({ style: "text-align: left; margin-bottom: 0px; font-size: x-small; height: 1.3em; color: " + ColorConfig.secondaryText + ";" }, p(""));

    readonly container = div({ class: "prompt noSelection", style: "width: 600px;" },
        this._editorTitle,
        div({ style: "display: flex; width: 55%; align-self: center; flex-direction: row; align-items: center; justify-content: center;" },
            this._playButton
        ),
        this._filterButtonContainer,
        this._filterContainer,
        div({ style: "display: flex; flex-direction: row-reverse; justify-content: space-between;" },
            this._okayButton,
            this._filterCopyPasteContainer,
        ),
        this._cancelButton,
    );

    // for some reason that is beyond me, the compiler claims that "'_effectIndex' is declared but its value is never read," which makes no sense because it is used on line 82. some1 with better knowledge than me can tell me why this happens... ~ theepie
    // @ts-ignore
    constructor(private _doc: SongDocument, private _songEditor: SongEditor, private _useNoteFilter: boolean, private forSong = false, private _effectIndex = 0) {
        this._okayButton.addEventListener("click", this._saveChanges);
        this._cancelButton.addEventListener("click", this._close);
        this._playButton.addEventListener("click", this._togglePlay);
        this._filterCopyButton.addEventListener("click", this._copyFilterSettings);
        this._filterPasteButton.addEventListener("click", this._pasteFilterSettings);
        this.updatePlayButton();
        let colors = ColorConfig.getChannelColor(this._doc.song, this._doc.song.channels[this._doc.channel].color, this._doc.channel, this._doc.prefs.fixChannelColorOrder);

        this.filterEditor = new FilterEditor(_doc, _useNoteFilter, true, this.forSong, _effectIndex);
        this._filterContainer.appendChild(this.filterEditor.container);

        // Add coordinates to editor
        this.filterEditor.container.insertBefore(this._filterCoordinateText, this.filterEditor.container.firstChild);
        this.filterEditor.coordText = this._filterCoordinateText;

        this._editorTitle.children[0].innerHTML = forSong ? "Edit Song EQ Filter" : (_useNoteFilter) ? "Edit Pre EQ" : "Edit Post EQ";

        let newButton = button({ class: "no-underline", style: "max-width: 5em;" }, "Main");
        this._filterButtonContainer.appendChild(newButton);
        this._filterButtons.push(newButton);
        newButton.addEventListener("click", () => { this._setSubfilter(0); });
        for (let i = 1; i < Config.filterMorphCount; i++) {
            let newSubButton = button({ class: "no-underline", style: "max-width: 2em;" }, "" + i);
            this._filterButtons.push(newSubButton);
            this._filterButtonContainer.appendChild(newSubButton);
            newSubButton.addEventListener("click", () => { this._setSubfilter(i); });
        }
        this._filterButtons[Config.filterMorphCount - 1].classList.add("last-button");
        this._filterButtons[0].classList.add("selected-instrument");

        this._filterButtonContainer.style.setProperty("--text-color-lit", colors.primaryNote);
        this._filterButtonContainer.style.setProperty("--text-color-dim", colors.secondaryNote);
        this._filterButtonContainer.style.setProperty("--background-color-lit", colors.primaryChannel);
        this._filterButtonContainer.style.setProperty("--background-color-dim", colors.secondaryChannel);

        this._filterContainer.addEventListener("keydown", this._whenKeyPressed);
        this.filterEditor.container.addEventListener("keydown", this._whenKeyPressed);
        this.container.addEventListener("keydown", this._whenKeyPressed);

        setTimeout(() => this._playButton.focus());

        this.filterEditor.render();
    }

    private _setSubfilter = (index: number, useHistory = true, doSwap = true): void => {
        this._filterButtons[this._subfilterIndex].classList.remove("selected-instrument");
        if (doSwap) this.filterEditor.swapToSubfilter(this._subfilterIndex, index, useHistory);
        this._subfilterIndex = index;
        this._filterButtons[index].classList.add("selected-instrument");
    }

    private _copyFilterSettings = (): void => {
        const filterCopy = this.forSong
            ? this._doc.song.eqFilter.toJsonObject()
            : this._useNoteFilter
            ? this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()].noteFilter.toJsonObject()
            : (<Effect>this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()].effects[0]).eqFilter.toJsonObject();
        nsLocalStorage_save("filterCopy", JSON.stringify(filterCopy));
    }

    private _pasteFilterSettings = (): void => {

        let filterCopy = new FilterSettings();
        filterCopy.fromJsonObject(JSON.parse(String(nsLocalStorage_get("filterCopy"))));
        if (filterCopy != null) {
            this.filterEditor.swapToSettings(filterCopy, true);
        }
    }

    private _whenKeyPressed = (event: KeyboardEvent): void => {
        if (event.keyCode == 90) { // z
            let newIdx = this.filterEditor.undo();
            if (newIdx >= 0) {
                this._setSubfilter(newIdx, false, false);
            }
            event.stopPropagation();
        }
        if (event.keyCode == 89) { // y
            let newIdx = this.filterEditor.redo();
            if (newIdx >= 0) {
                this._setSubfilter(newIdx, false, false);
            }
            event.stopPropagation();
        }
        // Number 1-9
        if (event.keyCode >= 49 && event.keyCode <= 57) {
            if (!event.shiftKey) {
                this.filterEditor.swapSubfilterIndices(event.keyCode - 49);
                event.stopPropagation();
            }
        }
    }

    private _togglePlay = (): void => {
        this._songEditor.togglePlay();
        this.updatePlayButton();
    }

    updatePlayButton(): void {
        if (this._doc.synth.playing) {
            this._playButton.classList.remove("playButton");
            this._playButton.classList.add("pauseButton");
            this._playButton.title = "Pause (Space)";
            this._playButton.innerText = "Pause";
        } else {
            this._playButton.classList.remove("pauseButton");
            this._playButton.classList.add("playButton");
            this._playButton.title = "Play (Space)";
            this._playButton.innerText = "Play";
        }
    }

    private _close = (): void => {
        this._doc.prompt = null;
        // Restore filter settings to default
        this.filterEditor.resetToInitial();
        this._doc.undo();
    }

    cleanUp = (): void => {
        this._okayButton.removeEventListener("click", this._saveChanges);
        this._cancelButton.removeEventListener("click", this._close);
        this.container.removeEventListener("keydown", this.whenKeyPressed);

        this._playButton.removeEventListener("click", this._togglePlay);
    }

    whenKeyPressed = (event: KeyboardEvent): void => {
        if ((<Element>event.target).tagName != "BUTTON" && event.keyCode == 13) { // Enter key
            this._saveChanges();
        }
        else if (event.keyCode == 32) { // space
            this._togglePlay();
            event.preventDefault();
        }
        else if (event.keyCode == 90) { // z
            this.filterEditor.undo();
            event.stopPropagation();
        }
        else if (event.keyCode == 89) { // y
            this.filterEditor.redo();
            event.stopPropagation();
        }
        else if (event.keyCode == 219) { // [
            this._doc.synth.goToPrevBar();
        }
        else if (event.keyCode == 221) { // ]
            this._doc.synth.goToNextBar();
        }
        else if (event.keyCode >= 48 && event.keyCode <= 57) { // 0-9
            if (event.shiftKey) {
                this._setSubfilter(event.keyCode - 48);
            }
        }

    }

    private _saveChanges = (): void => {
        this._doc.prompt = null;
        this.filterEditor.saveSettings();
    }
}
//}
