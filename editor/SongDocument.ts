// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Pattern } from "../synth/Pattern";
import { Song } from "../synth/Song";
import { Synth } from "../synth/synth";
import { Config } from "../synth/SynthConfig";
import { Change } from "./Change";
import { ChangeNotifier } from "./ChangeNotifier";
import { ChangeHoldingModRecording, ChangeSong, discardInvalidPatternInstruments, setDefaultInstruments } from "./changes";
import { ColorConfig } from "./ColorConfig";
import { isMobile } from "./EditorConfig";
import { Layout } from "./Layout";
import { Preferences } from "./Preferences";
import { Selection } from "./Selection";
import { SongPerformance } from "./SongPerformance";
import { SongRecovery, errorAlert, generateUid } from "./SongRecovery";

interface HistoryState {
    canUndo: boolean;
    sequenceNumber: number;
    bar: number;
    channel: number;
    instrument: number;
    recoveryUid: string;
    prompt: string | null;
    selection: { x0: number, x1: number, y0: number, y1: number, start: number, end: number };
    promptEffectIndex: number | null;
}

export class SongDocument {
    colorTheme: string;
    song: Song;
    synth: Synth;
    performance: SongPerformance;
    readonly notifier = new ChangeNotifier();
    readonly selection = new Selection(this);
    readonly prefs = new Preferences();
    channel = 0;
    muteEditorChannel = 0;
    bar = 0;
    recalcChannelNames: boolean;
    recalcChannelColors: boolean;
    recalcModChannels: boolean;
    recentPatternInstruments: number[][] = [];
    viewedInstrument: number[] = [];
    recordingModulators = false;
    continuingModRecordingChange: ChangeHoldingModRecording | null = null;

    trackVisibleBars = 16;
    trackVisibleChannels = 4;
    barScrollPos = 0;
    channelScrollPos = 0;
    prompt: string | null = null;
    promptEffectIndex: number | null = null;

    addedEffect = false;
    addedEnvelope = false;
    currentPatternIsDirty = false;
    modRecordingHandler: () => void;

    private static readonly _maximumUndoHistory = 300;
    private _recovery = new SongRecovery();
    private _recoveryUid: string;
    private _recentChange: Change | null = null;
    private _sequenceNumber = 0;
    private _lastSequenceNumber = 0;
    private _stateShouldBePushed = false;
    private _recordedNewSong = false;
    _waitingToUpdateState = false;

    constructor() {
        this.notifier.watch(this._validateDocState);

        ColorConfig.setTheme(this.prefs.colorTheme);
        Layout.setLayout(this.prefs.layout);

        if (window.sessionStorage.getItem("currentUndoIndex") == null) {
            window.sessionStorage.setItem("currentUndoIndex", "0");
            window.sessionStorage.setItem("oldestUndoIndex", "0");
            window.sessionStorage.setItem("newestUndoIndex", "0");
        }

        let songString = window.location.hash;
        if (songString == "") {
            songString = this._getHash();
        }
        try {
            this.song = new Song(songString);
            if (songString == "" || songString == undefined) {
                setDefaultInstruments(this.song);
                this.song.scale = this.prefs.defaultScale;
            }
        } catch (error) {
            errorAlert(error);
        }
        songString = this.song.toBase64String();
        this.synth = new Synth(this.song);
        this.synth.volume = this._calcVolume();
        this.synth.anticipatePoorPerformance = isMobile;

        let state: HistoryState | null = this._getHistoryState();
        if (state == null) {
            // When the page is first loaded, indicate that undo is NOT possible.
            state = { canUndo: false, sequenceNumber: 0, bar: 0, channel: 0, instrument: 0, recoveryUid: generateUid(), prompt: null, selection: this.selection.toJSON(), promptEffectIndex: null };
        }
        if (state.recoveryUid == undefined) state.recoveryUid = generateUid();
        this._replaceState(state, songString);
        window.addEventListener("hashchange", this._whenHistoryStateChanged);
        window.addEventListener("popstate", this._whenHistoryStateChanged);

        this.bar = state.bar | 0;
        this.channel = state.channel | 0;
        for (let i = 0; i <= this.channel; i++) this.viewedInstrument[i] = 0;
        this.viewedInstrument[this.channel] = state.instrument | 0;
        this._recoveryUid = state.recoveryUid;
        //this.barScrollPos = Math.max(0, this.bar - (this.trackVisibleBars - 6));
        this.prompt = state.prompt;
        this.selection.fromJSON(state.selection);
        this.selection.scrollToSelectedPattern();

        // For all input events, catch them when they are about to finish bubbling,
        // presumably after all handlers are done updating the model, then update the
        // view before the screen renders. mouseenter and mouseleave do not bubble,
        // but they are immediately followed by mousemove which does. 
        for (const eventName of ["change", "click", "keyup", "mousedown", "mouseup", "touchstart", "touchmove", "touchend", "touchcancel"]) {
            window.addEventListener(eventName, this._cleanDocument);
        }
        for (const eventName of ["keydown", "input", "mousemove"]) {
            window.addEventListener(eventName, this._cleanDocumentIfNotRecordingMods);
        }

        this._validateDocState();
        this.performance = new SongPerformance(this);
    }

    toggleDisplayBrowserUrl() {
        const state: HistoryState | null = this._getHistoryState();
        if (state == null) throw new Error("History state is null.");
        this.prefs.displayBrowserUrl = !this.prefs.displayBrowserUrl;
        this._replaceState(state, this.song.toBase64String());
    }

    private _getHistoryState(): HistoryState | null {
        if (this.prefs.displayBrowserUrl) {
            return window.history.state;
        } else {
            const json = JSON.parse(window.sessionStorage.getItem(window.sessionStorage.getItem("currentUndoIndex")!)!);
            return json == null ? null : json.state;
        }
    }

    private _getHash(): string {
        if (this.prefs.displayBrowserUrl) {
            return window.location.hash;
        } else {
            const json = JSON.parse(window.sessionStorage.getItem(window.sessionStorage.getItem("currentUndoIndex")!)!);
            return json == null ? "" : json.hash;
        }
    }

    private _replaceState(state: HistoryState, hash: string): void {
        if (this.prefs.displayBrowserUrl) {
            window.history.replaceState(state, "", "#" + hash);
        } else {
            window.sessionStorage.setItem(window.sessionStorage.getItem("currentUndoIndex") || "0", JSON.stringify({ state, hash }));
            window.history.replaceState(null, "", location.pathname);
        }
    }

    private _pushState(state: HistoryState, hash: string): void {
        if (this.prefs.displayBrowserUrl) {
            window.history.pushState(state, "", "#" + hash);
        } else {
            let currentIndex = Number(window.sessionStorage.getItem("currentUndoIndex"));
            let oldestIndex = Number(window.sessionStorage.getItem("oldestUndoIndex"));
            currentIndex = (currentIndex + 1) % SongDocument._maximumUndoHistory;
            window.sessionStorage.setItem("currentUndoIndex", String(currentIndex));
            window.sessionStorage.setItem("newestUndoIndex", String(currentIndex));
            if (currentIndex == oldestIndex) {
                oldestIndex = (oldestIndex + 1) % SongDocument._maximumUndoHistory;
                window.sessionStorage.setItem("oldestUndoIndex", String(oldestIndex));
            }
            window.sessionStorage.setItem(String(currentIndex), JSON.stringify({ state, hash }));
            window.history.replaceState(null, "", location.pathname);
        }
        this._lastSequenceNumber = state.sequenceNumber;
    }

	hasRedoHistory(): boolean {
		return this._lastSequenceNumber > this._sequenceNumber;
	}	
		
	private _forward(): void {
		if (this.prefs.displayBrowserUrl) {
			window.history.forward();
		} else {
			let currentIndex = Number(window.sessionStorage.getItem("currentUndoIndex"));
			let newestIndex = Number(window.sessionStorage.getItem("newestUndoIndex"));
			if (currentIndex != newestIndex) {
				currentIndex = (currentIndex + 1) % SongDocument._maximumUndoHistory;
				window.sessionStorage.setItem("currentUndoIndex", String(currentIndex));
				setTimeout(this._whenHistoryStateChanged);
			}
		}
	}
		
	private _back(): void {
		if (this.prefs.displayBrowserUrl) {
			window.history.back();
		} else {
			let currentIndex = Number(window.sessionStorage.getItem("currentUndoIndex"));
			let oldestIndex = Number(window.sessionStorage.getItem("oldestUndoIndex"));
			if (currentIndex != oldestIndex) {
				currentIndex = (currentIndex + SongDocument._maximumUndoHistory - 1) % SongDocument._maximumUndoHistory;
				window.sessionStorage.setItem("currentUndoIndex", String(currentIndex));
				setTimeout(this._whenHistoryStateChanged);
			}
		}
	}
		
	private _whenHistoryStateChanged = (): void => {
		if (this.synth.recording) {
			// Changes to the song while it's recording to could mess up the recording so just abort the recording.
			this.performance.abortRecording();
		}
		
		if (window.history.state == null && window.location.hash != "") {
			// The user changed the hash directly.
			this._sequenceNumber++;
			this._resetSongRecoveryUid();
			const state = {canUndo: true, sequenceNumber: this._sequenceNumber, bar: this.bar, channel: this.channel, instrument: this.viewedInstrument[this.channel], recoveryUid: this._recoveryUid, prompt: null, selection: this.selection.toJSON(), promptEffectIndex : this.promptEffectIndex};
			try {
				new ChangeSong(this, this._getHash());
			} catch (error) {
				errorAlert(error);
			}
			this.prompt = state.prompt;
			if (this.prefs.displayBrowserUrl) {
				this._replaceState(state, this.song.toBase64String());
			} else {
				this._pushState(state, this.song.toBase64String());
			}
			this.forgetLastChange();
			this.notifier.notifyWatchers();
			// Stop playing, and go to start when pasting new song in.
			this.synth.pause();
			this.synth.goToBar(0);
			return;
		}
			
		const state: HistoryState | null = this._getHistoryState();
		if (state == null) throw new Error("History state is null.");
			
		// Abort if we've already handled the current state. 
		if (state.sequenceNumber == this._sequenceNumber) return;
			
		this.bar = state.bar;
		this.channel = state.channel;
		this.viewedInstrument[this.channel] = state.instrument;
		this._sequenceNumber = state.sequenceNumber;
		this.prompt = state.prompt;
		try {
			new ChangeSong(this, this._getHash());
		} catch (error) {
			errorAlert(error);
		}
			
		this._recoveryUid = state.recoveryUid;
		this.selection.fromJSON(state.selection);
			
		//this.barScrollPos = Math.min(this.bar, Math.max(this.bar - (this.trackVisibleBars - 1), this.barScrollPos));
			
		this.forgetLastChange();
		this.notifier.notifyWatchers();
	}
		
	private _cleanDocument = (): void => {
		this.notifier.notifyWatchers();
	}

    private _cleanDocumentIfNotRecordingMods = (): void => {
        if (!this.recordingModulators)
            this.notifier.notifyWatchers();
        else {
            this.modRecordingHandler();
        }

    }

    private _validateDocState = (): void => {
        const channelCount = this.song.getChannelCount();
        for (let i = this.recentPatternInstruments.length; i < channelCount; i++) {
            this.recentPatternInstruments[i] = [0];
        }
        this.recentPatternInstruments.length = channelCount;
        for (let i = 0; i < channelCount; i++) {
            if (i == this.channel) {
                if (this.song.patternInstruments) {
                    const pattern: Pattern | null = this.song.getPattern(this.channel, this.bar);
                    if (pattern != null) {
                        this.recentPatternInstruments[i] = pattern.instruments.concat();
                    }
                } else {
                    const channel = this.song.channels[this.channel];
                    for (let j = 0; j < channel.instruments.length; j++) {
                        this.recentPatternInstruments[i][j] = j;
                    }
                    this.recentPatternInstruments[i].length = channel.instruments.length;
                }
            }
            discardInvalidPatternInstruments(this.recentPatternInstruments[i], this.song, i);
        }

        for (let i = this.viewedInstrument.length; i < channelCount; i++) {
            this.viewedInstrument[i] = 0;
        }
        this.viewedInstrument.length = channelCount;
        for (let i = 0; i < channelCount; i++) {
            if (this.song.patternInstruments && !this.song.layeredInstruments && i == this.channel) {
                const pattern: Pattern | null = this.song.getPattern(this.channel, this.bar);
                if (pattern != null) {
                    this.viewedInstrument[i] = pattern.instruments[0];
                }
            }
            this.viewedInstrument[i] = Math.min(this.viewedInstrument[i] | 0, this.song.channels[i].instruments.length - 1);
        }

        const highlightedPattern: Pattern | null = this.getCurrentPattern();
        if (highlightedPattern != null && this.song.patternInstruments) {
            this.recentPatternInstruments[this.channel] = highlightedPattern.instruments.concat();
        }

        // Normalize selection.
        // I'm allowing the doc.bar to drift outside the box selection while playing
        // because it may auto-follow the playhead outside the selection but it would
        // be annoying to lose your selection just because the song is playing.
        if ((!this.synth.playing && (this.bar < this.selection.boxSelectionBar || this.selection.boxSelectionBar + this.selection.boxSelectionWidth <= this.bar)) ||
            this.channel < this.selection.boxSelectionChannel ||
            this.selection.boxSelectionChannel + this.selection.boxSelectionHeight <= this.channel ||
            this.song.barCount < this.selection.boxSelectionBar + this.selection.boxSelectionWidth ||
            channelCount < this.selection.boxSelectionChannel + this.selection.boxSelectionHeight ||
            (this.selection.boxSelectionWidth == 1 && this.selection.boxSelectionHeight == 1)) {
            this.selection.resetBoxSelection();
        }

        this.barScrollPos = Math.max(0, Math.min(this.song.barCount - this.trackVisibleBars, this.barScrollPos));
        this.channelScrollPos = Math.max(0, Math.min(this.song.getChannelCount() - this.trackVisibleChannels, this.channelScrollPos));

    }

    private _updateHistoryState = (): void => {
        this._waitingToUpdateState = false;
        let hash: string;
        try {
            // Ensure that the song is not corrupted before saving it.
            hash = this.song.toBase64String();
        } catch (error) {
            errorAlert(error);
            return;
        }
        if (this._stateShouldBePushed) this._sequenceNumber++;
        if (this._recordedNewSong) {
            this._resetSongRecoveryUid();
        } else {
            this._recovery.saveVersion(this._recoveryUid, this.song.title, hash);
        }
        let state = { canUndo: true, sequenceNumber: this._sequenceNumber, bar: this.bar, channel: this.channel, instrument: this.viewedInstrument[this.channel], recoveryUid: this._recoveryUid, prompt: this.prompt, selection: this.selection.toJSON(), promptEffectIndex : this.promptEffectIndex };
        if (this._stateShouldBePushed) {
            this._pushState(state, hash);
        } else {
            this._replaceState(state, hash);
        }
        this._stateShouldBePushed = false;
        this._recordedNewSong = false;
    }

    record(change: Change, replace = false, newSong = false): void {
        if (change.isNoop()) {
            this._recentChange = null;
            if (replace) this._back();
        } else {
            change.commit();
            this._recentChange = change;
            this._stateShouldBePushed = this._stateShouldBePushed || !replace;
            this._recordedNewSong = this._recordedNewSong || newSong;
            if (!this._waitingToUpdateState) {
                // Defer updating the url/history until all sequenced changes have
                // committed and the interface has rendered the latest changes to
                // improve perceived responsiveness.
                window.requestAnimationFrame(this._updateHistoryState);
                this._waitingToUpdateState = true;
            }
        }
    }

    private _resetSongRecoveryUid(): void {
        this._recoveryUid = generateUid();
    }

    openPrompt(prompt: string, effectIndex?: number): void {
        this.prompt = prompt;
        if (effectIndex != undefined) this.promptEffectIndex = effectIndex;
        const hash = this.song.toBase64String();
        this._sequenceNumber++;
        const state = { canUndo: true, sequenceNumber: this._sequenceNumber, bar: this.bar, channel: this.channel, instrument: this.viewedInstrument[this.channel], recoveryUid: this._recoveryUid, prompt: this.prompt, selection: this.selection.toJSON(), promptEffectIndex : this.promptEffectIndex };
        this._pushState(state, hash);
    }

    undo(): void {
        const state: HistoryState | null = this._getHistoryState();
        if (state == null || state.canUndo) this._back();
    }

    redo(): void {
        this._forward();
    }

    setProspectiveChange(change: Change | null): void {
        this._recentChange = change;
    }

    forgetLastChange(): void {
        this._recentChange = null;
    }

    checkLastChange(): Change | null {
        return this._recentChange;
    }

    lastChangeWas(change: Change | null): boolean {
        return change != null && change == this._recentChange;
    }

    goBackToStart(): void {
        this.bar = 0;
        this.channel = 0;
        this.barScrollPos = 0;
        this.channelScrollPos = 0;
        this.synth.snapToStart();
        this.notifier.changed();
    }

    setVolume(val: number): void {
        this.prefs.volume = val;
        this.prefs.save();
        this.synth.volume = this._calcVolume();
    }

    private _calcVolume(): number {
        return Math.min(1.0, Math.pow(this.prefs.volume / 50.0, 0.5)) * Math.pow(2.0, (this.prefs.volume - 75.0) / 25.0);
    }

    getCurrentPattern(barOffset = 0): Pattern | null {
        return this.song.getPattern(this.channel, this.bar + barOffset);
    }

    getCurrentInstrument(barOffset = 0): number {
        if (barOffset == 0) {
            return this.viewedInstrument[this.channel];
        } else {
            const pattern: Pattern | null = this.getCurrentPattern(barOffset);
            return pattern == null ? 0 : pattern.instruments[0];
        }
    }

    getMobileLayout(): boolean {
        return (this.prefs.layout == "wide") ? window.innerWidth <= 1000 : window.innerWidth <= 710;
    }

    getBarWidth(): number {
        // Bugfix: In wide fullscreen, the 32 pixel display doesn't work as the trackEditor is still horizontally constrained
        return (!this.getMobileLayout() && this.prefs.enableChannelMuting && (!this.getFullScreen() || this.prefs.layout == "wide")) ? 30 : 32;
    }

    getChannelHeight(): number {
        const squashed = this.getMobileLayout() || this.song.getChannelCount() > 4 || (this.song.barCount > this.trackVisibleBars && this.song.getChannelCount() > 3);
        // TODO: Jummbox widescreen should allow more channels before squashing or megasquashing
        const megaSquashed = !this.getMobileLayout() && (((this.prefs.layout != "wide") && this.song.getChannelCount() > 11) || this.song.getChannelCount() > 22);
        return megaSquashed ? 23 : (squashed ? 27 : 32);
    }

    getFullScreen(): boolean {
        return !this.getMobileLayout() && (this.prefs.layout != "small") && (this.prefs.layout != "small+");
    }

    getVisibleOctaveCount(): number {
        return this.getFullScreen() ? this.prefs.visibleOctaves : Preferences.defaultVisibleOctaves;
    }

    getVisiblePitchCount(): number {
        return this.getVisibleOctaveCount() * Config.pitchesPerOctave + 1;
    }

    getBaseVisibleOctave(channel: number): number {
        const visibleOctaveCount = this.getVisibleOctaveCount();
        return Math.max(0, Math.min(Config.pitchOctaves - visibleOctaveCount, Math.ceil(this.song.channels[channel].octave - visibleOctaveCount * 0.5)));
    }
}
