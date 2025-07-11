// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Note, NotePin, Pattern } from "../synth/Pattern";
import { Config, Dictionary } from "../synth/SynthConfig";
import { ChangeGroup } from "./Change";
import { ColorConfig } from "./ColorConfig";
import { SongDocument } from "./SongDocument";
import { ChangeAddChannel, ChangeChannelBar, ChangeChannelOrder, ChangeDeleteBars, ChangeDuplicateSelectedReusedPatterns, ChangeEnsurePatternExists, ChangeInsertBars, ChangeModChannel, ChangeModEnvelope, ChangeModFilter, ChangeModInstrument, ChangeModSetting, ChangeNoteAdded, ChangeNoteLength, ChangeNoteTruncate, ChangePaste, ChangePatternNumbers, ChangePatternRhythm, ChangePatternScale, ChangePatternSelection, ChangePatternsPerChannel, ChangeRemoveChannel, ChangeRhythm, ChangeSetPatternInstruments, ChangeTrackSelection, ChangeTranspose, ChangeViewInstrument, comparePatternNotes, discardInvalidPatternInstruments, generateScaleMap, patternsContainSameInstruments, unionOfUsedNotes } from "./changes";
import { nsLocalStorage_get, nsLocalStorage_save } from "./namespaced_localStorage";

interface PatternCopy {
    instruments: number[];
    notes: any[];
}

interface ChannelCopy {
    isNoise: boolean;
    isMod: boolean;
    patterns: Dictionary<PatternCopy>;
    bars: number[];
}

interface SelectionCopy {
    partDuration: number;
    channels: ChannelCopy[];
}

export class Selection {
    boxSelectionX0 = 0;
    boxSelectionY0 = 0;
    boxSelectionX1 = 0;
    boxSelectionY1 = 0;
    digits = "";
    instrumentDigits = "";
    patternSelectionStart = 0;
    patternSelectionEnd = 0;
    patternSelectionActive = false;

    private _changeTranspose: ChangeGroup | null = null;
    private _changeTrack: ChangeGroup | null = null;
    private _changeInstrument: ChangeGroup | null = null;
    private _changeReorder: ChangeGroup | null = null;

    constructor(private _doc: SongDocument) { }

    toJSON(): { x0: number, x1: number, y0: number, y1: number, start: number, end: number } {
        return {
            "x0": this.boxSelectionX0,
            "x1": this.boxSelectionX1,
            "y0": this.boxSelectionY0,
            "y1": this.boxSelectionY1,
            "start": this.patternSelectionStart,
            "end": this.patternSelectionEnd,
        };
    }

    fromJSON(json: { x0: number, x1: number, y0: number, y1: number, start: number, end: number }): void {
        if (json == null) return;
        this.boxSelectionX0 = +json["x0"];
        this.boxSelectionX1 = +json["x1"];
        this.boxSelectionY0 = +json["y0"];
        this.boxSelectionY1 = +json["y1"];
        this.patternSelectionStart = +json["start"];
        this.patternSelectionEnd = +json["end"];
        this.digits = "";
        this.instrumentDigits = "";
        this.patternSelectionActive = this.patternSelectionStart < this.patternSelectionEnd;
    }

    selectionUpdated(): void {
        this._doc.notifier.changed();
        this.digits = "";
        this.instrumentDigits = "";
    }

    get boxSelectionBar(): number {
        return Math.min(this.boxSelectionX0, this.boxSelectionX1);
    }
    get boxSelectionChannel(): number {
        return Math.min(this.boxSelectionY0, this.boxSelectionY1);
    }
    get boxSelectionWidth(): number {
        return Math.abs(this.boxSelectionX0 - this.boxSelectionX1) + 1;
    }
    get boxSelectionHeight(): number {
        return Math.abs(this.boxSelectionY0 - this.boxSelectionY1) + 1;
    }
    get boxSelectionActive(): boolean {
        return this.boxSelectionWidth > 1 || this.boxSelectionHeight > 1;
    }
    scrollToSelectedPattern(): void {
        this._doc.barScrollPos = Math.min(this._doc.bar, Math.max(this._doc.bar - (this._doc.trackVisibleBars - 1), this._doc.barScrollPos));
        this._doc.channelScrollPos = Math.min(this._doc.channel, Math.max(this._doc.channel - (this._doc.trackVisibleChannels - 1), this._doc.channelScrollPos));
    }
    scrollToEndOfSelection(): void {
        this._doc.barScrollPos = Math.min(this.boxSelectionX1, Math.max(this.boxSelectionX1 - (this._doc.trackVisibleBars - 1), this._doc.barScrollPos));
        this._doc.channelScrollPos = Math.min(this.boxSelectionY1, Math.max(this.boxSelectionY1 - (this._doc.trackVisibleChannels - 1), this._doc.channelScrollPos));
    }

    setChannelBar(channelIndex: number, bar: number): void {
        if (channelIndex == this._doc.channel && bar == this._doc.bar) return;
        const canReplaceLastChange = this._doc.lastChangeWas(this._changeTrack);
        this._changeTrack = new ChangeGroup();
        this._changeTrack.append(new ChangeChannelBar(this._doc, channelIndex, bar));
        // @jummbus - changing current viewed instrument to the first for the current pattern if the viewedInstrument is not in the pattern
        const pattern: Pattern | null = this._doc.getCurrentPattern(0);
        if (pattern != null) {
            if (pattern.instruments.indexOf(this._doc.viewedInstrument[this._doc.channel]) < 0) {
                this._doc.viewedInstrument[this._doc.channel] = pattern.instruments[0];
            }
        }
        // Don't erase existing redo history just to look at highlighted pattern.
        if (!this._doc.hasRedoHistory()) {
            this._doc.record(this._changeTrack, canReplaceLastChange);
        }
        this.selectionUpdated();

    }

    setPattern(pattern: number): void {
        this._doc.record(new ChangePatternNumbers(this._doc, pattern, this.boxSelectionBar, this.boxSelectionChannel, this.boxSelectionWidth, this.boxSelectionHeight));
    }

    nextDigit(digit: string, forInstrument: boolean, forRhythms: boolean): void {
        if (forRhythms) {
            if (digit == "3") {
                this._doc.record(new ChangeRhythm(this._doc, 0));
            }
            else if (digit == "4") {
                this._doc.record(new ChangeRhythm(this._doc, 1));
            }
            else if (digit == "6") {
                this._doc.record(new ChangeRhythm(this._doc, 2));
            }
            else if (digit == "8") {
                this._doc.record(new ChangeRhythm(this._doc, 3));
            }
            else if (digit == "0" || digit == "1") {
                this._doc.record(new ChangeRhythm(this._doc, 4));
            }
        } else if (forInstrument) {
            // Treat "0" as meaning instrument 10
            if (digit == "0") digit = "10";
            this.instrumentDigits += digit;
            var parsed = parseInt(this.instrumentDigits);
            //var pattern: Pattern | null = this._doc.getCurrentPattern();
            if (parsed != 0 && parsed <= this._doc.song.channels[this._doc.channel].instruments.length) {
                this.selectInstrument(parsed - 1);
                return;
            }
            this.instrumentDigits = digit;
            parsed = parseInt(this.instrumentDigits);
            if (parsed != 0 && parsed <= this._doc.song.channels[this._doc.channel].instruments.length) {
                this.selectInstrument(parsed - 1);
                return;
            }
            this.instrumentDigits = "";
        }
        else {
            this.digits += digit;
            let parsed = parseInt(this.digits);
            if (parsed <= this._doc.song.patternsPerChannel) {

                this.setPattern(parsed);

                return;
            }

            this.digits = digit;
            parsed = parseInt(this.digits);
            if (parsed <= this._doc.song.patternsPerChannel) {

                this.setPattern(parsed);

                return;
            }

            this.digits = "";
        }
    }

    setModChannel(mod: number, index: number): void {
        this._doc.record(new ChangeModChannel(this._doc, mod, index));
    }

    setModInstrument(mod: number, instrument: number): void {
        this._doc.record(new ChangeModInstrument(this._doc, mod, instrument));
    }

    setModSetting(mod: number, text: string): void {
        this._doc.record(new ChangeModSetting(this._doc, mod, text));
    }

    setModFilter(mod: number, type: number): void {
        this._doc.record(new ChangeModFilter(this._doc, mod, type));
    }

    setModEnvelope(mod: number, type: number): void {
        this._doc.record(new ChangeModEnvelope(this._doc, mod, type));
    }

    insertBars(): void {
        this._doc.record(new ChangeInsertBars(this._doc, this.boxSelectionBar + this.boxSelectionWidth, this.boxSelectionWidth));
        const width = this.boxSelectionWidth;
        this.boxSelectionX0 += width;
        this.boxSelectionX1 += width;
    }

    insertChannel(): void {
        const group = new ChangeGroup();
        const insertIndex = this.boxSelectionChannel + this.boxSelectionHeight;
        const isNoise = this._doc.song.getChannelIsNoise(insertIndex - 1);
        const isMod = this._doc.song.getChannelIsMod(insertIndex - 1)
        group.append(new ChangeAddChannel(this._doc, insertIndex, isNoise, isMod));
        if (!group.isNoop()) {
            this.boxSelectionY0 = this.boxSelectionY1 = insertIndex;
            group.append(new ChangeChannelBar(this._doc, insertIndex, this._doc.bar));
            this._doc.record(group);
        }
    }

    deleteBars(): void {
        const group = new ChangeGroup();
        if (this._doc.selection.patternSelectionActive) {

            if (this.boxSelectionActive) {
                group.append(new ChangeDuplicateSelectedReusedPatterns(this._doc, this.boxSelectionBar, this.boxSelectionWidth, this.boxSelectionChannel, this.boxSelectionHeight, false));
            }

            for (const channelIndex of this._eachSelectedChannel()) {
                for (const pattern of this._eachSelectedPattern(channelIndex)) {
                    group.append(new ChangeNoteTruncate(this._doc, pattern, this._doc.selection.patternSelectionStart, this._doc.selection.patternSelectionEnd));
                }
            }
            group.append(new ChangePatternSelection(this._doc, 0, 0));
        } else {
            group.append(new ChangeDeleteBars(this._doc, this.boxSelectionBar, this.boxSelectionWidth));
            const width = this.boxSelectionWidth;
            this.boxSelectionX0 = Math.max(0, this.boxSelectionX0 - width);
            this.boxSelectionX1 = Math.max(0, this.boxSelectionX1 - width);
        }
        this._doc.record(group);
    }

    deleteChannel(): void {
        this._doc.record(new ChangeRemoveChannel(this._doc, this.boxSelectionChannel, this.boxSelectionChannel + this.boxSelectionHeight - 1));
        this.boxSelectionY0 = this.boxSelectionY1 = this._doc.channel;
        ColorConfig.resetColors();
    }

    private * _eachSelectedChannel(): IterableIterator<number> {
        for (let channelIndex = this.boxSelectionChannel; channelIndex < this.boxSelectionChannel + this.boxSelectionHeight; channelIndex++) {
            yield channelIndex;
        }
    }

    private * _eachSelectedBar(): IterableIterator<number> {
        for (let bar = this.boxSelectionBar; bar < this.boxSelectionBar + this.boxSelectionWidth; bar++) {
            yield bar;
        }
    }

    private *_eachSelectedPattern(channelIndex: number): IterableIterator<Pattern> {
        const handledPatterns: Dictionary<boolean> = {};
        for (const bar of this._eachSelectedBar()) {
            const currentPatternIndex = this._doc.song.channels[channelIndex].bars[bar];
            if (currentPatternIndex == 0) continue;
            if (handledPatterns[String(currentPatternIndex)]) continue;
            handledPatterns[String(currentPatternIndex)] = true;
            const pattern: Pattern | null = this._doc.song.getPattern(channelIndex, bar);
            if (pattern == null) throw new Error();
            yield pattern;
        }
    }

    private _parseCopiedInstrumentArray(patternCopy: any, channelIndex: number): number[] {
        const instruments: number[] = Array.from(patternCopy["instruments"]).map(i => (<any>i) >>> 0);
        discardInvalidPatternInstruments(instruments, this._doc.song, channelIndex);
        return instruments;
    }

    private _patternIndexIsUnused(channelIndex: number, patternIndex: number): boolean {
        for (let i = 0; i < this._doc.song.barCount; i++) {
            if (this._doc.song.channels[channelIndex].bars[i] == patternIndex) {
                return false;
            }
        }
        return true;
    }

    copy(): void {
        const channels: ChannelCopy[] = [];

        for (const channelIndex of this._eachSelectedChannel()) {
            const patterns: Dictionary<PatternCopy> = {};
            const bars: number[] = [];

            for (const bar of this._eachSelectedBar()) {
                const patternNumber = this._doc.song.channels[channelIndex].bars[bar];
                bars.push(patternNumber);
                if (patterns[String(patternNumber)] == undefined) {
                    const pattern: Pattern | null = this._doc.song.getPattern(channelIndex, bar);
                    let instruments: number[] = this._doc.recentPatternInstruments[channelIndex];
                    let notes: Note[] = [];
                    if (pattern != null) {
                        instruments = pattern.instruments.concat();

                        if (this.patternSelectionActive) {
                            for (const note of pattern.cloneNotes()) {
                                if (note.end <= this.patternSelectionStart) continue;
                                if (note.start >= this.patternSelectionEnd) continue;
                                note.start -= this.patternSelectionStart;
                                note.end -= this.patternSelectionStart;
                                if (note.start < 0 || note.end > this.patternSelectionEnd - this.patternSelectionStart) {
                                    new ChangeNoteLength(null, note, Math.max(note.start, 0), Math.min(this.patternSelectionEnd - this.patternSelectionStart, note.end));
                                }
                                notes.push(note);
                            }
                        } else {
                            notes = pattern.notes;
                        }
                    }
                    patterns[String(patternNumber)] = { "instruments": instruments, "notes": notes };
                }
            }

            const channelCopy = {
                "isNoise": this._doc.song.getChannelIsNoise(channelIndex),
                "isMod": this._doc.song.getChannelIsMod(channelIndex),
                "patterns": patterns,
                "bars": bars,
            };
            channels.push(channelCopy);
        }

        const selectionCopy = {
            "partDuration": this.patternSelectionActive ? this.patternSelectionEnd - this.patternSelectionStart : this._doc.song.beatsPerBar * Config.partsPerBeat,
            "channels": channels,
        };
        nsLocalStorage_save("selectionCopy", JSON.stringify(selectionCopy));
        // Clear selection after copy
        new ChangePatternSelection(this._doc, 0, 0);
    }

    private _remapToNoisePitches(oldPitches: number[]): number[] {
        let newPitches: number[] = oldPitches.slice();
        // There may be some very "pleasing" way to place these,
        // but I'm not sure it's worth the effort.
        newPitches.sort(function (a: number, b: number): number { return a - b; });
        let lowestPitch = newPitches[0] % Config.drumCount;
        const numberOfPitches = newPitches.length;
        let highestPitch = lowestPitch + (numberOfPitches - 1);
        while (highestPitch >= Config.drumCount) {
            lowestPitch--;
            highestPitch--;
        }
        for (let notePitchIndex = 0; notePitchIndex < newPitches.length; notePitchIndex++) {
            newPitches[notePitchIndex] = notePitchIndex + lowestPitch;
        }
        return newPitches;
    }
    private _convertCopiedPitchNotesToNoiseNotes(oldNotes: Note[]): Note[] {
        // When pasting from a pitch channel to a noise channel,
        // we may have pitches beyond what a noise channel supports.
        let newNotes: Note[] = [];
        for (let noteIndex = 0; noteIndex < oldNotes.length; noteIndex++) {
            const oldNote = oldNotes[noteIndex];
            const newNotePitches: number[] = this._remapToNoisePitches(oldNote["pitches"].slice());
            const oldNotePins: NotePin[] = oldNote.pins;
            let newNotePins: NotePin[] = [];
            for (let notePinIndex = 0; notePinIndex < oldNotePins.length; notePinIndex++) {
                const oldPin = oldNotePins[notePinIndex];
                newNotePins.push({
                    interval: oldPin.interval,
                    time: oldPin.time,
                    size: oldPin.size,
                });
            }
            const newNoteStart = oldNote["start"];
            const newNoteEnd = oldNote["end"];
            const newNoteContinuesLastPattern = oldNote["continuesLastPattern"];
            const newNote = new Note(0, newNoteStart, newNoteEnd, 0, false);
            newNote.pitches = newNotePitches;
            newNote.pins = newNotePins;
            newNote.continuesLastPattern = newNoteContinuesLastPattern;
            newNotes.push(newNote);
        }
        return newNotes;
    }

    cutNotes(): void {
        const group = new ChangeGroup();
        const channelIndex = this.boxSelectionChannel;
        const barIndex = this.boxSelectionBar;
        const cutHeight = this.boxSelectionHeight;
        const cutWidth = this.boxSelectionWidth;
        this.copy();
        for (let channel = channelIndex; channel < channelIndex + cutHeight; channel++) {
            for (let bar = barIndex; bar < barIndex + cutWidth; bar++) {
                const patternNumber = this._doc.song.channels[channel].bars[bar];
                if (patternNumber != 0) {
                    const pattern = this._doc.song.channels[channel].patterns[patternNumber - 1];
                    group.append(new ChangeNoteTruncate(this._doc, pattern, 0, Config.partsPerBeat * this._doc.song.beatsPerBar));
                }
            }
        }
        this._doc.record(group);
    }

    // I'm sorry this function is so complicated!
    // Basically I'm trying to avoid accidentally modifying patterns that are used
    // elsewhere in the song (unless we're just pasting a single pattern) but I'm
    // also trying to reuse patterns where it makes sense to do so, especially 
    // in the same channel it was copied from.
    pasteNotes(): void {
        const selectionCopy: SelectionCopy | null = JSON.parse(String(nsLocalStorage_get("selectionCopy")));
        if (selectionCopy == null) return;
        const channelCopies: ChannelCopy[] = selectionCopy["channels"] || [];
        const copiedPartDuration = selectionCopy["partDuration"] >>> 0;

        const group = new ChangeGroup();
        const fillSelection = (this.boxSelectionWidth > 1 || this.boxSelectionHeight > 1);

        const pasteHeight = fillSelection ? this.boxSelectionHeight : Math.min(channelCopies.length, this._doc.song.getChannelCount() - this.boxSelectionChannel);
        for (let pasteChannel = 0; pasteChannel < pasteHeight; pasteChannel++) {
            const channelCopy = channelCopies[pasteChannel % channelCopies.length];
            const channelIndex = this.boxSelectionChannel + pasteChannel;
            const channelIsNoise = this._doc.song.getChannelIsNoise(channelIndex);

            const isNoise = !!channelCopy["isNoise"];
            const isMod = !!channelCopy["isMod"];
            const isPitch = !isNoise && !isMod;
            const patternCopies: Dictionary<PatternCopy> = channelCopy["patterns"] || {};
            const copiedBars: number[] = channelCopy["bars"] || [];
            if (copiedBars.length == 0) continue;
            // Allow pasting from a pitch channel to a noise channel (and the opposite).
            if (isNoise && this._doc.song.getChannelIsMod(channelIndex)) continue;
            if (isMod != this._doc.song.getChannelIsMod(channelIndex)) continue;
            // if (isNoise != this._doc.song.getChannelIsNoise(channelIndex))
            //     continue;

            const pasteWidth = fillSelection ? this.boxSelectionWidth : Math.min(copiedBars.length, this._doc.song.barCount - this.boxSelectionBar);
            if (!fillSelection && copiedBars.length == 1 && channelCopies.length == 1) {
                // Special case: if there's just one pattern being copied, try to insert it
                // into whatever pattern is already selected.
                const copiedPatternIndex = copiedBars[0] >>> 0;
                const bar = this.boxSelectionBar;
                const currentPatternIndex = this._doc.song.channels[channelIndex].bars[bar];
                if (copiedPatternIndex == 0 && currentPatternIndex == 0) continue;

                const patternCopy = patternCopies[String(copiedPatternIndex)];

                const instrumentsCopy: number[] = this._parseCopiedInstrumentArray(patternCopy, channelIndex);

                let pastedNotes: Note[] = patternCopy["notes"];
                if (isPitch && channelIsNoise) {
                    pastedNotes = this._convertCopiedPitchNotesToNoiseNotes(pastedNotes);
                }

                if (currentPatternIndex == 0) {
                    const existingPattern: Pattern | undefined = this._doc.song.channels[channelIndex].patterns[copiedPatternIndex - 1];
                    if (existingPattern != undefined &&
                        !this.patternSelectionActive &&
                        ((comparePatternNotes(pastedNotes, existingPattern.notes) && patternsContainSameInstruments(instrumentsCopy, existingPattern.instruments)) ||
                            this._patternIndexIsUnused(channelIndex, copiedPatternIndex))) {
                        group.append(new ChangePatternNumbers(this._doc, copiedPatternIndex, bar, channelIndex, 1, 1));
                    } else {
                        group.append(new ChangeEnsurePatternExists(this._doc, channelIndex, bar));
                    }
                }

                const pattern: Pattern | null = this._doc.song.getPattern(channelIndex, bar);
                if (pattern == null) throw new Error();
                group.append(new ChangePaste(this._doc, pattern, pastedNotes, this.patternSelectionActive ? this.patternSelectionStart : 0, this.patternSelectionActive ? this.patternSelectionEnd : Config.partsPerBeat * this._doc.song.beatsPerBar, copiedPartDuration));
                // @jummbus - I actually like it better if instruments copy over, unless it's not a mod and there are notes in the pattern.
                if (currentPatternIndex == 0 || patternCopy.notes.length == 0 || channelIndex >= this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount) {
                    this.selectInstrument(instrumentsCopy[0]);
                    group.append(new ChangeSetPatternInstruments(this._doc, channelIndex, instrumentsCopy, pattern));
                }
            } else if (this.patternSelectionActive) {
                const reusablePatterns: Dictionary<number> = {};
                const usedPatterns: Dictionary<boolean> = {};

                group.append(new ChangeDuplicateSelectedReusedPatterns(this._doc, this.boxSelectionBar, pasteWidth, this.boxSelectionChannel, pasteHeight, false));

                for (let pasteBar = 0; pasteBar < pasteWidth; pasteBar++) {
                    const bar = this.boxSelectionBar + pasteBar;
                    const copiedPatternIndex = copiedBars[pasteBar % copiedBars.length] >>> 0;
                    const currentPatternIndex = this._doc.song.channels[channelIndex].bars[bar];
                    const reusedIndex = [copiedPatternIndex, currentPatternIndex].join(",");
                    if (copiedPatternIndex == 0 && currentPatternIndex == 0) continue;
                    if (reusablePatterns[reusedIndex] != undefined) {
                        group.append(new ChangePatternNumbers(this._doc, reusablePatterns[reusedIndex], bar, channelIndex, 1, 1));
                        continue;
                    }

                    if (currentPatternIndex == 0) {
                        group.append(new ChangeEnsurePatternExists(this._doc, channelIndex, bar));
                        const patternCopy = patternCopies[String(copiedPatternIndex)];
                        const instrumentsCopy: number[] = this._parseCopiedInstrumentArray(patternCopy, channelIndex);
                        const pattern = this._doc.song.getPattern(channelIndex, bar)!;
                        group.append(new ChangeSetPatternInstruments(this._doc, channelIndex, instrumentsCopy, pattern));
                    } else {
                        const pattern: Pattern | null = this._doc.song.getPattern(channelIndex, bar);
                        if (pattern == null) throw new Error();

                        if (!usedPatterns[String(currentPatternIndex)]) {
                            usedPatterns[String(currentPatternIndex)] = true;
                        } else {
                            // If this pattern is used here and elsewhere, it's not safe to modify it directly, so
                            // make a duplicate of it and modify that instead.
                            group.append(new ChangePatternNumbers(this._doc, 0, bar, channelIndex, 1, 1));
                            group.append(new ChangeEnsurePatternExists(this._doc, channelIndex, bar));
                            const newPattern: Pattern | null = this._doc.song.getPattern(channelIndex, bar);
                            if (newPattern == null) throw new Error();
                            for (const note of pattern.cloneNotes()) {
                                if (isPitch && channelIsNoise) {
                                    note.pitches = this._remapToNoisePitches(note.pitches);
                                }
                                group.append(new ChangeNoteAdded(this._doc, newPattern, note, newPattern.notes.length, false));
                            }
                            // Don't overwrite the existing pattern's instruments if only part of the pattern content is being replaced.
                            //group.append(new ChangeSetPatternInstruments(this._doc, channelIndex, pattern.instruments, newPattern));
                        }
                    }

                    const pattern: Pattern | null = this._doc.song.getPattern(channelIndex, bar);
                    if (pattern == null) throw new Error();
                    if (copiedPatternIndex == 0) {
                        group.append(new ChangeNoteTruncate(this._doc, pattern, this.patternSelectionStart, this.patternSelectionEnd));
                    } else {
                        const patternCopy = patternCopies[String(copiedPatternIndex)];
                        let pastedNotes: Note[] = patternCopy["notes"];
                        if (isPitch && channelIsNoise) {
                            pastedNotes = this._convertCopiedPitchNotesToNoiseNotes(pastedNotes);
                        }
                        group.append(new ChangePaste(this._doc, pattern, pastedNotes, this.patternSelectionStart, this.patternSelectionEnd, copiedPartDuration));
                    }

                    reusablePatterns[reusedIndex] = this._doc.song.channels[channelIndex].bars[bar];
                }
            } else {
                for (let pasteBar = 0; pasteBar < pasteWidth; pasteBar++) {
                    // When a pattern becomes unused when replaced by rectangular selection pasting,
                    // remove all the notes from the pattern so that it may be reused.
                    this.erasePatternInBar(group, channelIndex, this.boxSelectionBar + pasteBar);
                }

                const reusablePatterns: Dictionary<number> = {};
                for (let pasteBar = 0; pasteBar < pasteWidth; pasteBar++) {
                    const bar = this.boxSelectionBar + pasteBar;
                    const copiedPatternIndex = copiedBars[pasteBar % copiedBars.length] >>> 0;
                    const reusedIndex = String(copiedPatternIndex);
                    if (copiedPatternIndex == 0) continue;
                    if (reusablePatterns[reusedIndex] != undefined) {
                        group.append(new ChangePatternNumbers(this._doc, reusablePatterns[reusedIndex], bar, channelIndex, 1, 1));
                        continue;
                    }
                    const patternCopy = patternCopies[String(copiedPatternIndex)];
                    const instrumentsCopy: number[] = this._parseCopiedInstrumentArray(patternCopy, channelIndex);
                    const existingPattern: Pattern | undefined = this._doc.song.channels[channelIndex].patterns[copiedPatternIndex - 1];

                    let pastedNotes: Note[] = patternCopy["notes"];
                    if (isPitch && channelIsNoise) {
                        pastedNotes = this._convertCopiedPitchNotesToNoiseNotes(pastedNotes);
                    }

                    if (existingPattern != undefined &&
                        copiedPartDuration == Config.partsPerBeat * this._doc.song.beatsPerBar &&
                        comparePatternNotes(pastedNotes, existingPattern.notes) &&
                        patternsContainSameInstruments(instrumentsCopy, existingPattern.instruments)) {
                        group.append(new ChangePatternNumbers(this._doc, copiedPatternIndex, bar, channelIndex, 1, 1));
                    } else {
                        if (existingPattern != undefined && this._patternIndexIsUnused(channelIndex, copiedPatternIndex)) {
                            group.append(new ChangePatternNumbers(this._doc, copiedPatternIndex, bar, channelIndex, 1, 1));
                        } else {
                            group.append(new ChangeEnsurePatternExists(this._doc, channelIndex, bar));
                        }
                        const pattern: Pattern | null = this._doc.song.getPattern(channelIndex, bar);
                        if (pattern == null) throw new Error();
                        group.append(new ChangePaste(this._doc, pattern, pastedNotes, this.patternSelectionActive ? this.patternSelectionStart : 0, this.patternSelectionActive ? this.patternSelectionEnd : Config.partsPerBeat * this._doc.song.beatsPerBar, copiedPartDuration));
                        group.append(new ChangeSetPatternInstruments(this._doc, channelIndex, instrumentsCopy, pattern));
                    }

                    reusablePatterns[reusedIndex] = this._doc.song.channels[channelIndex].bars[bar];

                }
            }
        }

        this._doc.record(group);
    }

    // Set a bar's pattern number to zero, and if that pattern was not used
    // elsewhere in the channel, erase all notes in it as well.
    erasePatternInBar(group: ChangeGroup, channelIndex: number, bar: number): void {
        const removedPattern = this._doc.song.channels[channelIndex].bars[bar];
        if (removedPattern != 0) {
            group.append(new ChangePatternNumbers(this._doc, 0, bar, channelIndex, 1, 1));
            if (this._patternIndexIsUnused(channelIndex, removedPattern)) {
                // When a pattern becomes unused when replaced by rectangular selection pasting,
                // remove all the notes from the pattern so that it may be reused.
                this._doc.song.channels[channelIndex].patterns[removedPattern - 1].notes.length = 0;
            }
        }
    }

    pasteNumbers(): void {
        const selectionCopy: SelectionCopy | null = JSON.parse(String(nsLocalStorage_get("selectionCopy")));
        if (selectionCopy == null) return;
        const channelCopies: ChannelCopy[] = selectionCopy["channels"] || [];

        const group = new ChangeGroup();
        const fillSelection = this.boxSelectionActive;

        const pasteHeight = fillSelection ? this.boxSelectionHeight : Math.min(channelCopies.length, this._doc.song.getChannelCount() - this.boxSelectionChannel);
        for (let pasteChannel = 0; pasteChannel < pasteHeight; pasteChannel++) {
            const channelCopy = channelCopies[pasteChannel % channelCopies.length];
            const channelIndex = this.boxSelectionChannel + pasteChannel;

            const copiedBars: number[] = channelCopy["bars"] || [];
            if (copiedBars.length == 0) continue;

            const pasteWidth = fillSelection ? this.boxSelectionWidth : Math.min(copiedBars.length, this._doc.song.barCount - this.boxSelectionBar);
            for (let pasteBar = 0; pasteBar < pasteWidth; pasteBar++) {
                const copiedPatternIndex = copiedBars[pasteBar % copiedBars.length] >>> 0;
                const bar = this.boxSelectionBar + pasteBar;

                if (copiedPatternIndex > this._doc.song.patternsPerChannel) {
                    group.append(new ChangePatternsPerChannel(this._doc, copiedPatternIndex));
                }

                group.append(new ChangePatternNumbers(this._doc, copiedPatternIndex, bar, channelIndex, 1, 1));
            }
        }

        this._doc.record(group);
    }

    selectAll(): void {
        new ChangePatternSelection(this._doc, 0, 0);
        if (this.boxSelectionBar == 0 &&
            this.boxSelectionChannel == 0 &&
            this.boxSelectionWidth == this._doc.song.barCount &&
            this.boxSelectionHeight == this._doc.song.getChannelCount()) {
            this.setTrackSelection(this._doc.bar, this._doc.bar, this._doc.channel, this._doc.channel);
        } else {
            this.setTrackSelection(0, this._doc.song.barCount - 1, 0, this._doc.song.getChannelCount() - 1);
        }
        this.selectionUpdated();
    }

    selectChannel(): void {
        new ChangePatternSelection(this._doc, 0, 0);
        if (this.boxSelectionBar == 0 && this.boxSelectionWidth == this._doc.song.barCount) {
            this.setTrackSelection(this._doc.bar, this._doc.bar, this.boxSelectionY0, this.boxSelectionY1);
        } else {
            this.setTrackSelection(0, this._doc.song.barCount - 1, this.boxSelectionY0, this.boxSelectionY1);
        }
        this.selectionUpdated();
    }

    duplicatePatterns(replaceUnused: boolean): void {
        this._doc.record(new ChangeDuplicateSelectedReusedPatterns(this._doc, this.boxSelectionBar, this.boxSelectionWidth, this.boxSelectionChannel, this.boxSelectionHeight, replaceUnused));
    }

    muteChannels(allChannels: boolean): void {
        if (allChannels) {
            let anyMuted = false;
            for (let channelIndex = 0; channelIndex < this._doc.song.channels.length; channelIndex++) {
                if (this._doc.song.channels[channelIndex].muted) {
                    anyMuted = true;
                    break;
                }
            }
            for (let channelIndex = 0; channelIndex < this._doc.song.channels.length; channelIndex++) {
                this._doc.song.channels[channelIndex].muted = !anyMuted;
            }
        } else {
            let anyUnmuted = false;
            for (const channelIndex of this._eachSelectedChannel()) {
                if (!this._doc.song.channels[channelIndex].muted) {
                    anyUnmuted = true;
                    break;
                }
            }
            for (const channelIndex of this._eachSelectedChannel()) {
                this._doc.song.channels[channelIndex].muted = anyUnmuted;
            }
        }

        this._doc.notifier.changed();
    }

    hideChannels(allChannels: boolean): void {
        if (allChannels) {
            let anyVisible = false;
            for (let channelIndex = 0; channelIndex < this._doc.song.channels.length; channelIndex++) {
                if (this._doc.song.channels[channelIndex].visible) {
                    anyVisible = true;
                    break;
                }
            }
            for (let channelIndex = 0; channelIndex < this._doc.song.channels.length; channelIndex++) {
                this._doc.song.channels[channelIndex].visible = !anyVisible;
            }
        } else {
            let anyInvisible = false;
            for (const channelIndex of this._eachSelectedChannel()) {
                if (!this._doc.song.channels[channelIndex].visible) {
                    anyInvisible = true;
                    break;
                }
            }
            for (const channelIndex of this._eachSelectedChannel()) {
                this._doc.song.channels[channelIndex].visible = anyInvisible;
            }
        }

        this._doc.notifier.changed();
    }

    soloChannels(invert: boolean): void {
        let alreadySoloed = true;

        // Soloing mod channels - solo all channels affected by the mod, instead
        if (this.boxSelectionChannel >= this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount) {

            const currentChannel = this._doc.song.channels[this.boxSelectionChannel];
            const bar = currentChannel.bars[this._doc.bar] - 1;
            const modInstrument = (bar >= 0) ? currentChannel.instruments[currentChannel.patterns[bar].instruments[0]] : currentChannel.instruments[this._doc.viewedInstrument[this.boxSelectionChannel]];
            const soloPattern: boolean[] = [];
            let matchesSoloPattern = !invert;

            // First pass: determine solo pattern
            for (let channelIndex = 0; channelIndex < this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount; channelIndex++) {
                soloPattern[channelIndex] = false;
                for (let mod = 0; mod < Config.modCount; mod++) {
                    for (let channels = 0; channels < modInstrument.modChannels[mod].length; channels++) {
                        if (modInstrument.modChannels[mod][channels] == channelIndex) {
                            soloPattern[channelIndex] = true;
                        }
                    }
                }
            }

            // Second pass: determine if channels match solo pattern, overall
            for (let channelIndex = 0; channelIndex < this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount; channelIndex++) {
                if (this._doc.song.channels[channelIndex].muted == soloPattern[channelIndex]) {
                    matchesSoloPattern = invert;
                    break;
                }
            }

            // Third pass: Actually apply solo pattern or unmute all
            for (let channelIndex = 0; channelIndex < this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount; channelIndex++) {
                if (matchesSoloPattern) {
                    this._doc.song.channels[channelIndex].muted = false;
                }
                else {
                    this._doc.song.channels[channelIndex].muted = !soloPattern[channelIndex];
                }
            }

        }
        else {

            for (let channelIndex = 0; channelIndex < this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount; channelIndex++) {
                const shouldBeMuted = (channelIndex < this.boxSelectionChannel || channelIndex >= this.boxSelectionChannel + this.boxSelectionHeight) ? !invert : invert;
                if (this._doc.song.channels[channelIndex].muted != shouldBeMuted) {
                    alreadySoloed = false;
                    break;
                }
            }

            if (alreadySoloed) {
                for (let channelIndex = 0; channelIndex < this._doc.song.channels.length; channelIndex++) {
                    this._doc.song.channels[channelIndex].muted = false;
                }
            } else {
                for (let channelIndex = 0; channelIndex < this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount; channelIndex++) {
                    this._doc.song.channels[channelIndex].muted = (channelIndex < this.boxSelectionChannel || channelIndex >= this.boxSelectionChannel + this.boxSelectionHeight) ? !invert : invert;
                }
            }

        }

        this._doc.notifier.changed();
    }

    showChannels(invert: boolean): void {
        let alreadyShown = true;

        for (let channelIndex = 0; channelIndex < this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount; channelIndex++) {
            const shouldBeHidden = (channelIndex < this.boxSelectionChannel || channelIndex >= this.boxSelectionChannel + this.boxSelectionHeight) ? invert : !invert;
            if (this._doc.song.channels[channelIndex].visible != shouldBeHidden) {
                alreadyShown = false;
                break;
            }
        }

        if (alreadyShown) {
            for (let channelIndex = 0; channelIndex < this._doc.song.channels.length; channelIndex++) {
                this._doc.song.channels[channelIndex].visible = true;
            }
        } else {
            for (let channelIndex = 0; channelIndex < this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount; channelIndex++) {
                this._doc.song.channels[channelIndex].visible = (channelIndex < this.boxSelectionChannel || channelIndex >= this.boxSelectionChannel + this.boxSelectionHeight) ? invert : !invert;
            }
        }

        this._doc.notifier.changed();
    }

    forceRhythm(): void {
        const group = new ChangeGroup();

        if (this.boxSelectionActive) {
            group.append(new ChangeDuplicateSelectedReusedPatterns(this._doc, this.boxSelectionBar, this.boxSelectionWidth, this.boxSelectionChannel, this.boxSelectionHeight, false));
        }

        for (const channelIndex of this._eachSelectedChannel()) {
            for (const pattern of this._eachSelectedPattern(channelIndex)) {
                group.append(new ChangePatternRhythm(this._doc, pattern));
            }
        }

        this._doc.record(group);
    }

    forceScale(): void {
        const group = new ChangeGroup();

        if (this.boxSelectionActive) {
            group.append(new ChangeDuplicateSelectedReusedPatterns(this._doc, this.boxSelectionBar, this.boxSelectionWidth, this.boxSelectionChannel, this.boxSelectionHeight, false));
        }

        const scaleFlags: boolean[] = [true, false, false, false, false, false, false, false, false, false, false, false];
        for (const channelIndex of this._eachSelectedChannel()) {
            if (this._doc.song.getChannelIsNoise(channelIndex) || this._doc.song.getChannelIsMod(channelIndex)) continue;
            for (const pattern of this._eachSelectedPattern(channelIndex)) {
                unionOfUsedNotes(pattern, scaleFlags);
            }
        }

        const scaleMap: number[] = generateScaleMap(scaleFlags, this._doc.song.scale, this._doc.song.scaleCustom);

        for (const channelIndex of this._eachSelectedChannel()) {
            if (this._doc.song.getChannelIsNoise(channelIndex) || this._doc.song.getChannelIsMod(channelIndex)) continue;
            for (const pattern of this._eachSelectedPattern(channelIndex)) {
                group.append(new ChangePatternScale(this._doc, pattern, scaleMap));
            }
        }

        this._doc.record(group);
    }

    setTrackSelection(newX0: number, newX1: number, newY0: number, newY1: number): void {
        const canReplaceLastChange = true;//this._doc.lastChangeWas(this._changeTrack);
        this._changeTrack = new ChangeGroup();
        this._changeTrack.append(new ChangeTrackSelection(this._doc, newX0, newX1, newY0, newY1));
        this._doc.record(this._changeTrack, canReplaceLastChange);
    }

    transpose(upward: boolean, octave: boolean): void {
        const canReplaceLastChange = this._doc.lastChangeWas(this._changeTranspose);
        this._changeTranspose = new ChangeGroup();

        if (this.boxSelectionActive) {
            this._changeTranspose.append(new ChangeDuplicateSelectedReusedPatterns(this._doc, this.boxSelectionBar, this.boxSelectionWidth, this.boxSelectionChannel, this.boxSelectionHeight, false));
        }

        for (const channelIndex of this._eachSelectedChannel()) {
            // Can't transpose mod channels.
            if (channelIndex >= this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount)
                continue;
            for (const pattern of this._eachSelectedPattern(channelIndex)) {
                this._changeTranspose.append(new ChangeTranspose(this._doc, channelIndex, pattern, upward, this._doc.prefs.notesOutsideScale, octave));
            }
        }

        this._doc.record(this._changeTranspose, canReplaceLastChange);
    }

    swapChannels(offset: number): void {
        const possibleSectionBoundaries: number[] = [
            this._doc.song.pitchChannelCount,
            this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount,
            this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount + this._doc.song.modChannelCount,
            this._doc.song.getChannelCount(),
        ];
        let channelSectionMin = 0;
        let channelSectionMax = 0;
        for (const nextBoundary of possibleSectionBoundaries) {
            if ((this.boxSelectionChannel < nextBoundary && offset < 0) || (this.boxSelectionChannel + this.boxSelectionHeight <= nextBoundary)) {
                channelSectionMax = nextBoundary - 1;
                break;
            }
            channelSectionMin = nextBoundary;
        }
        const newSelectionMin = Math.max(this.boxSelectionChannel, channelSectionMin);
        const newSelectionMax = Math.min(this.boxSelectionChannel + this.boxSelectionHeight - 1, channelSectionMax);
        offset = Math.max(offset, channelSectionMin - newSelectionMin);
        offset = Math.min(offset, channelSectionMax - newSelectionMax);

        if (offset != 0) {
            const canReplaceLastChange = this._doc.lastChangeWas(this._changeReorder);
            this._changeReorder = new ChangeGroup();
            this.boxSelectionY0 = newSelectionMin + offset;
            this.boxSelectionY1 = newSelectionMax + offset;
            this._changeReorder.append(new ChangeChannelOrder(this._doc, newSelectionMin, newSelectionMax, offset));
            this._changeReorder.append(new ChangeChannelBar(this._doc, Math.max(this.boxSelectionY0, Math.min(this.boxSelectionY1, this._doc.channel + offset)), this._doc.bar));
            this.selectionUpdated();
            this._doc.record(this._changeReorder, canReplaceLastChange);
        }
    }

    selectInstrument(instrument: number): void {
        if (this._doc.viewedInstrument[this._doc.channel] == instrument) {
            // Multi-selection is not possible for mods... that would not make much sense.
            if (this._doc.song.layeredInstruments && this._doc.song.patternInstruments && this._doc.channel < this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount) {
                const canReplaceLastChange = this._doc.lastChangeWas(this._changeInstrument);
                this._changeInstrument = new ChangeGroup();
                const instruments: number[] = this._doc.recentPatternInstruments[this._doc.channel];
                this._doc.notifier.changed(); // doc.recentPatternInstruments changes even if a 0 pattern is selected.
                if (instruments.indexOf(instrument) == -1) {
                    instruments.push(instrument);
                    const maxLayers = this._doc.song.getMaxInstrumentsPerPattern(this._doc.channel);
                    if (instruments.length > maxLayers) {
                        instruments.splice(0, instruments.length - maxLayers);
                    }
                } else {
                    instruments.splice(instruments.indexOf(instrument), 1);
                    if (instruments.length == 0) instruments[0] = 0;
                }

                if (this.boxSelectionActive) {
                    this._changeInstrument.append(new ChangeDuplicateSelectedReusedPatterns(this._doc, this.boxSelectionBar, this.boxSelectionWidth, this.boxSelectionChannel, this.boxSelectionHeight, false));
                }
                for (const channelIndex of this._eachSelectedChannel()) {
                    for (const pattern of this._eachSelectedPattern(channelIndex)) {
                        this._changeInstrument.append(new ChangeSetPatternInstruments(this._doc, channelIndex, instruments, pattern));
                    }
                }
                if (!this._changeInstrument.isNoop())
                    this._doc.record(this._changeInstrument, canReplaceLastChange);
            }
        } else {
            const canReplaceLastChange = this._doc.lastChangeWas(this._changeInstrument);
            this._changeInstrument = new ChangeGroup();
            this._changeInstrument.append(new ChangeViewInstrument(this._doc, instrument));

            if (!(this._doc.song.layeredInstruments && this._doc.channel < this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount) && this._doc.song.patternInstruments) {
                if (this.boxSelectionActive) {
                    this._changeInstrument.append(new ChangeDuplicateSelectedReusedPatterns(this._doc, this.boxSelectionBar, this.boxSelectionWidth, this.boxSelectionChannel, this.boxSelectionHeight, false));
                }
                const instruments: number[] = [instrument];
                for (const channelIndex of this._eachSelectedChannel()) {
                    for (const pattern of this._eachSelectedPattern(channelIndex)) {
                        this._changeInstrument.append(new ChangeSetPatternInstruments(this._doc, channelIndex, instruments, pattern));
                    }
                }
                this._doc.record(this._changeInstrument, canReplaceLastChange);
            } else if (!this._doc.hasRedoHistory()) {
                // Don't erase existing redo history just to look at highlighted pattern.
                this._doc.record(this._changeInstrument, canReplaceLastChange);
            }
        }
    }

    resetBoxSelection(): void {
        this.boxSelectionX0 = this.boxSelectionX1 = this._doc.bar;
        this.boxSelectionY0 = this.boxSelectionY1 = this._doc.channel;
    }
}
