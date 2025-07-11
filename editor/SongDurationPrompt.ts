// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Config } from "../synth/SynthConfig";
import { HTML } from "imperative-html/dist/esm/elements-strict";
import { SongDocument } from "./SongDocument";
import { Prompt } from "./Prompt";
import { ChangeGroup } from "./Change";
import { ChangeBarCount } from "./changes";
import { ColorConfig } from "./ColorConfig";
import { ExportPrompt } from "./ExportPrompt";
import { nsLocalStorage_get, nsLocalStorage_save } from "./namespaced_localStorage";

const { button, div, span, h2, input, br, select, option } = HTML;

export class SongDurationPrompt implements Prompt {
    private readonly _computedSamplesLabel = div({ style: "width: 10em;" }, new Text("0:00"));
    private readonly _barsStepper = input({ style: "width: 3em; margin-left: 1em;", type: "number", step: "1" });
    private readonly _positionSelect = select({ style: "width: 100%;" },
        option({ value: "end" }, "Apply change at end of song."),
        option({ value: "beginning" }, "Apply change at beginning of song."),
    );
    private readonly _cancelButton = button({ class: "cancelButton" });
    private readonly _okayButton = button({ class: "okayButton", style: "width:45%;" }, "Okay");

    readonly container = div({ class: "prompt noSelection", style: "width: 250px;" },
        h2("Song Length"),
        div({ style: "display: flex; flex-direction: row; align-items: center; justify-content: space-between;" },
            "Length:",
            this._computedSamplesLabel,
        ),
        div({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" },
            div({ style: "display: inline-block; text-align: right;" },
                "Bars per song:",
                br(),
                span({ style: `font-size: smaller; color: ${ColorConfig.secondaryText};` }, "(Multiples of 4 are recommended)"),

            ),
            this._barsStepper,
        ),
        div({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" },
            div({ class: "selectContainer", style: "width: 100%;" }, this._positionSelect),
        ),
        div({ style: "display: flex; flex-direction: row-reverse; justify-content: space-between;" },
            this._okayButton,
        ),
        this._cancelButton,
    );

    constructor(private _doc: SongDocument) {

        this._barsStepper.value = this._doc.song.barCount + "";
        this._barsStepper.min = Config.barCountMin + "";
        this._barsStepper.max = Config.barCountMax + "";

        const lastPosition: string | null = nsLocalStorage_get("barCountPosition");
        if (lastPosition != null) {
            this._positionSelect.value = lastPosition;
        }

        this._barsStepper.select();
        setTimeout(() => this._barsStepper.focus());

        this._okayButton.addEventListener("click", this._saveChanges);
        this._cancelButton.addEventListener("click", this._close);
        this._barsStepper.addEventListener("keypress", SongDurationPrompt._validateKey);
        this._barsStepper.addEventListener("blur", SongDurationPrompt._validateNumber);
        this.container.addEventListener("keydown", this._whenKeyPressed);
        this._barsStepper.addEventListener("input", () => { (this._computedSamplesLabel.firstChild as Text).textContent = this._predictFutureLength(); });
        this._positionSelect.addEventListener("change", () => { (this._computedSamplesLabel.firstChild as Text).textContent = this._predictFutureLength(); });
        (this._computedSamplesLabel.firstChild as Text).textContent = ExportPrompt.samplesToTime(this._doc, this._doc.synth.getTotalSamples(true, true, 0));
    }

    private _close = (): void => {
        this._doc.undo();
    }

    cleanUp = (): void => {
        this._okayButton.removeEventListener("click", this._saveChanges);
        this._cancelButton.removeEventListener("click", this._close);
        this._barsStepper.removeEventListener("keypress", SongDurationPrompt._validateKey);
        this._barsStepper.removeEventListener("blur", SongDurationPrompt._validateNumber);
        this.container.removeEventListener("keydown", this._whenKeyPressed);
    }

    private _whenKeyPressed = (event: KeyboardEvent): void => {
        if ((<Element>event.target).tagName != "BUTTON" && event.keyCode == 13) { // Enter key
            this._saveChanges();
        }
    }

    private static _validateKey(event: KeyboardEvent): boolean {
        const charCode = (event.which) ? event.which : event.keyCode;
        if (charCode != 46 && charCode > 31 && (charCode < 48 || charCode > 57)) {
            event.preventDefault();
            return true;
        }
        return false;
    }

    private static _validateNumber(event: Event): void {
        const input = <HTMLInputElement>event.target;
        input.value = String(SongDurationPrompt._validate(input));
    }

    private static _validate(input: HTMLInputElement): number {
        return Math.floor(Math.max(Number(input.min), Math.min(Number(input.max), Number(input.value))));
    }

    private _predictFutureLength(): string {
        const futureDoc = new SongDocument();
        futureDoc.synth.song?.fromBase64String(this._doc.synth.song?.toBase64String() ? this._doc.synth.song?.toBase64String() : "");
        new ChangeBarCount(futureDoc, SongDurationPrompt._validate(this._barsStepper), this._positionSelect.value == "beginning");
        return ExportPrompt.samplesToTime(futureDoc, futureDoc.synth.getTotalSamples(true, true, 0));
    }

    private _saveChanges = (): void => {
        nsLocalStorage_save("barCountPosition", this._positionSelect.value);
        const group = new ChangeGroup();
        group.append(new ChangeBarCount(this._doc, SongDurationPrompt._validate(this._barsStepper), this._positionSelect.value == "beginning"));
        this._doc.prompt = null;
        this._doc.record(group, true);
    }
}