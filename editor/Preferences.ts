// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import {Scale, Config} from "../synth/SynthConfig";
import {ColorConfig} from "../editor/ColorConfig";

export class Preferences {
	static readonly defaultVisibleOctaves = 3;
	
	customTheme: string | null;
	customTheme2: string | null;
	autoPlay: boolean;
	autoFollow: boolean;
	enableNotePreview: boolean;
	showFifth = true;
	notesOutsideScale: boolean;
	defaultScale: number;
	showLetters: boolean;
	showChannels: boolean;
	showScrollBar: boolean;
	alwaysFineNoteVol: boolean;
	displayVolumeBar: boolean;
	instrumentCopyPaste: boolean;
	instrumentImportExport: boolean;
	instrumentButtonsAtTop: boolean;
	enableChannelMuting: boolean;
	colorTheme: string;
	fixChannelColorOrder: boolean;
	layout: string;
	displayBrowserUrl: boolean;
	volume = 75;
	visibleOctaves = Preferences.defaultVisibleOctaves;
	pressControlForShortcuts: boolean;
	keyboardLayout: string;
	bassOffset: number;
	enableMidi: boolean;
	showRecordButton: boolean;
	snapRecordedNotesToRhythm: boolean;
	ignorePerformedNotesNotInScale: boolean;
	metronomeCountIn: boolean;
	metronomeWhileRecording: boolean;
	notesFlashWhenPlayed: boolean;
	showOscilloscope: boolean;
	showSampleLoadingStatus: boolean;
	showDescription: boolean;
	showInstrumentScrollbars: boolean;
	closePromptByClickoff: boolean;
	frostedGlassBackground: boolean;
	
	constructor() {
		this.reload();
	}
	
	reload(): void {
		this.autoPlay = window.localStorage.getItem("autoPlay") == "true";
		this.autoFollow = window.localStorage.getItem("autoFollow") == "true";
		this.enableNotePreview = window.localStorage.getItem("enableNotePreview") != "false";
		this.showFifth = window.localStorage.getItem("showFifth") != "false";
		this.notesOutsideScale = window.localStorage.getItem("notesOutsideScale") == "true";
		this.showLetters = window.localStorage.getItem("showLetters") != "false";
		this.showChannels = window.localStorage.getItem("showChannels") != "false";
		this.showScrollBar = window.localStorage.getItem("showScrollBar") != "false";
		this.alwaysFineNoteVol = window.localStorage.getItem("alwaysFineNoteVol") == "true";
		this.displayVolumeBar = window.localStorage.getItem("displayVolumeBar") != "false";
		this.instrumentCopyPaste = window.localStorage.getItem("instrumentCopyPaste") != "false";
		this.instrumentImportExport = window.localStorage.getItem("instrumentImportExport") == "true";
		this.instrumentButtonsAtTop = window.localStorage.getItem("instrumentButtonsAtTop") != "false"
		this.enableChannelMuting = window.localStorage.getItem("enableChannelMuting") != "false";
		this.fixChannelColorOrder = window.localStorage.getItem("fixChannelColorOrder") != "false";
		this.displayBrowserUrl = window.localStorage.getItem("displayBrowserUrl") != "false";
		this.pressControlForShortcuts = window.localStorage.getItem("pressControlForShortcuts") == "true";
		this.enableMidi = window.localStorage.getItem("enableMidi") != "false";
		this.showRecordButton = window.localStorage.getItem("showRecordButton") == "true";
		this.snapRecordedNotesToRhythm = window.localStorage.getItem("snapRecordedNotesToRhythm") == "true";
		this.ignorePerformedNotesNotInScale = window.localStorage.getItem("ignorePerformedNotesNotInScale") == "true";
		this.metronomeCountIn = window.localStorage.getItem("metronomeCountIn") != "false";
		this.metronomeWhileRecording = window.localStorage.getItem("metronomeWhileRecording") != "false";
		this.notesFlashWhenPlayed = window.localStorage.getItem("notesFlashWhenPlayed") == "true";
		this.showOscilloscope = window.localStorage.getItem("showOscilloscope") != "false";
		this.showSampleLoadingStatus = window.localStorage.getItem("showSampleLoadingStatus") != "false";
		this.showDescription = window.localStorage.getItem("showDescription") != "false";
		this.showInstrumentScrollbars = window.localStorage.getItem("showInstrumentScrollbars") == "true";
		this.closePromptByClickoff = window.localStorage.getItem("closePromptByClickoff") == "true";
		this.frostedGlassBackground = window.localStorage.getItem("frostedGlassBackground") == "true";
		this.keyboardLayout = window.localStorage.getItem("keyboardLayout") || "pianoAtC";
		this.bassOffset = (+(<any>window.localStorage.getItem("bassOffset"))) || 0;
		this.layout = window.localStorage.getItem("layout") || "small+";
		this.colorTheme = window.localStorage.getItem("colorTheme") || ColorConfig.defaultTheme;
		this.customTheme = window.localStorage.getItem("customTheme");
        this.customTheme2 = window.localStorage.getItem("customTheme2");
		this.visibleOctaves = ((<any>window.localStorage.getItem("visibleOctaves")) >>> 0) || Preferences.defaultVisibleOctaves;
		
		const defaultScale: Scale | undefined = Config.scales.dictionary[window.localStorage.getItem("defaultScale")!];
		this.defaultScale = (defaultScale != undefined) ? defaultScale.index : 1;
		
		if (window.localStorage.getItem("volume") != null) {
			this.volume = Math.min(<any>window.localStorage.getItem("volume") >>> 0, 75);
		}
		
		if (window.localStorage.getItem("fullScreen") != null) {
			if (window.localStorage.getItem("fullScreen") == "true") this.layout = "long";
			window.localStorage.removeItem("fullScreen");
		}
		
	}
	
	save(): void {
		window.localStorage.setItem("autoPlay", this.autoPlay ? "true" : "false");
		window.localStorage.setItem("autoFollow", this.autoFollow ? "true" : "false");
		window.localStorage.setItem("enableNotePreview", this.enableNotePreview ? "true" : "false");
		window.localStorage.setItem("showFifth", this.showFifth ? "true" : "false");
		window.localStorage.setItem("notesOutsideScale", this.notesOutsideScale ? "true" : "false");
		window.localStorage.setItem("defaultScale", Config.scales[this.defaultScale].name);
		window.localStorage.setItem("showLetters", this.showLetters ? "true" : "false");
		window.localStorage.setItem("showChannels", this.showChannels ? "true" : "false");
		window.localStorage.setItem("showScrollBar", this.showScrollBar ? "true" : "false");
		window.localStorage.setItem("alwaysFineNoteVol", this.alwaysFineNoteVol ? "true" : "false");
		window.localStorage.setItem("displayVolumeBar", this.displayVolumeBar ? "true" : "false");
		window.localStorage.setItem("enableChannelMuting", this.enableChannelMuting ? "true" : "false");
		window.localStorage.setItem("fixChannelColorOrder", this.fixChannelColorOrder ? "true" : "false");
		window.localStorage.setItem("instrumentCopyPaste", this.instrumentCopyPaste ? "true" : "false");
		window.localStorage.setItem("instrumentImportExport", this.instrumentImportExport ? "true" : "false");
		window.localStorage.setItem("instrumentButtonsAtTop", this.instrumentButtonsAtTop ? "true" : "false");
		window.localStorage.setItem("displayBrowserUrl", this.displayBrowserUrl ? "true" : "false");
		window.localStorage.setItem("pressControlForShortcuts", this.pressControlForShortcuts ? "true" : "false");
		window.localStorage.setItem("enableMidi", this.enableMidi ? "true" : "false");
		window.localStorage.setItem("showRecordButton", this.showRecordButton ? "true" : "false");
		window.localStorage.setItem("snapRecordedNotesToRhythm", this.snapRecordedNotesToRhythm ? "true" : "false");
		window.localStorage.setItem("ignorePerformedNotesNotInScale", this.ignorePerformedNotesNotInScale ? "true" : "false");
		window.localStorage.setItem("metronomeCountIn", this.metronomeCountIn ? "true" : "false");
		window.localStorage.setItem("metronomeWhileRecording", this.metronomeWhileRecording ? "true" : "false");
		window.localStorage.setItem("notesFlashWhenPlayed", this.notesFlashWhenPlayed ? "true" : "false");
		window.localStorage.setItem("showOscilloscope", this.showOscilloscope ? "true" : "false");
		window.localStorage.setItem("showSampleLoadingStatus", this.showSampleLoadingStatus ? "true" : "false");
		window.localStorage.setItem("showDescription", this.showDescription ? "true" : "false");
		window.localStorage.setItem("showInstrumentScrollbars", this.showInstrumentScrollbars ? "true" : "false");
		window.localStorage.setItem("closePromptByClickoff", this.closePromptByClickoff ? "true" : "false");
		window.localStorage.setItem("frostedGlassBackground", this.frostedGlassBackground ? "true" : "false");
		window.localStorage.setItem("keyboardLayout", this.keyboardLayout);
		window.localStorage.setItem("bassOffset", String(this.bassOffset));
		window.localStorage.setItem("layout", this.layout);
		window.localStorage.setItem("colorTheme", this.colorTheme);
		window.localStorage.setItem("customTheme", this.customTheme!);
		window.localStorage.setItem("customTheme2", this.customTheme2!);
		window.localStorage.setItem("volume", String(this.volume));
		window.localStorage.setItem("visibleOctaves", String(this.visibleOctaves));
		
	}
}
