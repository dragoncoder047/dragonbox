// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { ColorConfig } from "../editor/ColorConfig";
import { Config, Scale } from "../synth/SynthConfig";
import { nsLocalStorage_clear, nsLocalStorage_get, nsLocalStorage_save } from "./namespaced_localStorage";

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
		this.autoPlay = nsLocalStorage_get("autoPlay") == "true";
		this.autoFollow = nsLocalStorage_get("autoFollow") == "true";
		this.enableNotePreview = nsLocalStorage_get("enableNotePreview") != "false";
		this.showFifth = nsLocalStorage_get("showFifth") != "false";
		this.notesOutsideScale = nsLocalStorage_get("notesOutsideScale") == "true";
		this.showLetters = nsLocalStorage_get("showLetters") != "false";
		this.showChannels = nsLocalStorage_get("showChannels") != "false";
		this.showScrollBar = nsLocalStorage_get("showScrollBar") != "false";
		this.alwaysFineNoteVol = nsLocalStorage_get("alwaysFineNoteVol") == "true";
		this.displayVolumeBar = nsLocalStorage_get("displayVolumeBar") != "false";
		this.instrumentCopyPaste = nsLocalStorage_get("instrumentCopyPaste") != "false";
		this.instrumentImportExport = nsLocalStorage_get("instrumentImportExport") == "true";
		this.instrumentButtonsAtTop = nsLocalStorage_get("instrumentButtonsAtTop") != "false"
		this.enableChannelMuting = nsLocalStorage_get("enableChannelMuting") != "false";
		this.fixChannelColorOrder = nsLocalStorage_get("fixChannelColorOrder") != "false";
		this.displayBrowserUrl = nsLocalStorage_get("displayBrowserUrl") != "false";
		this.pressControlForShortcuts = nsLocalStorage_get("pressControlForShortcuts") == "true";
		this.enableMidi = nsLocalStorage_get("enableMidi") != "false";
		this.showRecordButton = nsLocalStorage_get("showRecordButton") == "true";
		this.snapRecordedNotesToRhythm = nsLocalStorage_get("snapRecordedNotesToRhythm") == "true";
		this.ignorePerformedNotesNotInScale = nsLocalStorage_get("ignorePerformedNotesNotInScale") == "true";
		this.metronomeCountIn = nsLocalStorage_get("metronomeCountIn") != "false";
		this.metronomeWhileRecording = nsLocalStorage_get("metronomeWhileRecording") != "false";
		this.notesFlashWhenPlayed = nsLocalStorage_get("notesFlashWhenPlayed") == "true";
		this.showOscilloscope = nsLocalStorage_get("showOscilloscope") != "false";
		this.showSampleLoadingStatus = nsLocalStorage_get("showSampleLoadingStatus") != "false";
		this.showDescription = nsLocalStorage_get("showDescription") != "false";
		this.showInstrumentScrollbars = nsLocalStorage_get("showInstrumentScrollbars") == "true";
		this.closePromptByClickoff = nsLocalStorage_get("closePromptByClickoff") == "true";
		this.frostedGlassBackground = nsLocalStorage_get("frostedGlassBackground") == "true";
		this.keyboardLayout = nsLocalStorage_get("keyboardLayout") || "pianoAtC";
		this.bassOffset = (+(<any>nsLocalStorage_get("bassOffset"))) || 0;
		this.layout = nsLocalStorage_get("layout") || "small+";
		this.colorTheme = nsLocalStorage_get("colorTheme") || ColorConfig.defaultTheme;
		this.customTheme = nsLocalStorage_get("customTheme");
        this.customTheme2 = nsLocalStorage_get("customTheme2");
		this.visibleOctaves = ((<any>nsLocalStorage_get("visibleOctaves")) >>> 0) || Preferences.defaultVisibleOctaves;
		
		const defaultScale: Scale | undefined = Config.scales.dictionary[nsLocalStorage_get("defaultScale")!];
		this.defaultScale = (defaultScale != undefined) ? defaultScale.index : 1;
		
		if (nsLocalStorage_get("volume") != null) {
			this.volume = Math.min(<any>nsLocalStorage_get("volume") >>> 0, 75);
		}
		
		if (nsLocalStorage_get("fullScreen") != null) {
			if (nsLocalStorage_get("fullScreen") == "true") this.layout = "long";
			nsLocalStorage_clear("fullScreen");
		}
		
	}
	
	save(): void {
		nsLocalStorage_save("autoPlay", this.autoPlay ? "true" : "false");
		nsLocalStorage_save("autoFollow", this.autoFollow ? "true" : "false");
		nsLocalStorage_save("enableNotePreview", this.enableNotePreview ? "true" : "false");
		nsLocalStorage_save("showFifth", this.showFifth ? "true" : "false");
		nsLocalStorage_save("notesOutsideScale", this.notesOutsideScale ? "true" : "false");
		nsLocalStorage_save("defaultScale", Config.scales[this.defaultScale].name);
		nsLocalStorage_save("showLetters", this.showLetters ? "true" : "false");
		nsLocalStorage_save("showChannels", this.showChannels ? "true" : "false");
		nsLocalStorage_save("showScrollBar", this.showScrollBar ? "true" : "false");
		nsLocalStorage_save("alwaysFineNoteVol", this.alwaysFineNoteVol ? "true" : "false");
		nsLocalStorage_save("displayVolumeBar", this.displayVolumeBar ? "true" : "false");
		nsLocalStorage_save("enableChannelMuting", this.enableChannelMuting ? "true" : "false");
		nsLocalStorage_save("fixChannelColorOrder", this.fixChannelColorOrder ? "true" : "false");
		nsLocalStorage_save("instrumentCopyPaste", this.instrumentCopyPaste ? "true" : "false");
		nsLocalStorage_save("instrumentImportExport", this.instrumentImportExport ? "true" : "false");
		nsLocalStorage_save("instrumentButtonsAtTop", this.instrumentButtonsAtTop ? "true" : "false");
		nsLocalStorage_save("displayBrowserUrl", this.displayBrowserUrl ? "true" : "false");
		nsLocalStorage_save("pressControlForShortcuts", this.pressControlForShortcuts ? "true" : "false");
		nsLocalStorage_save("enableMidi", this.enableMidi ? "true" : "false");
		nsLocalStorage_save("showRecordButton", this.showRecordButton ? "true" : "false");
		nsLocalStorage_save("snapRecordedNotesToRhythm", this.snapRecordedNotesToRhythm ? "true" : "false");
		nsLocalStorage_save("ignorePerformedNotesNotInScale", this.ignorePerformedNotesNotInScale ? "true" : "false");
		nsLocalStorage_save("metronomeCountIn", this.metronomeCountIn ? "true" : "false");
		nsLocalStorage_save("metronomeWhileRecording", this.metronomeWhileRecording ? "true" : "false");
		nsLocalStorage_save("notesFlashWhenPlayed", this.notesFlashWhenPlayed ? "true" : "false");
		nsLocalStorage_save("showOscilloscope", this.showOscilloscope ? "true" : "false");
		nsLocalStorage_save("showSampleLoadingStatus", this.showSampleLoadingStatus ? "true" : "false");
		nsLocalStorage_save("showDescription", this.showDescription ? "true" : "false");
		nsLocalStorage_save("showInstrumentScrollbars", this.showInstrumentScrollbars ? "true" : "false");
		nsLocalStorage_save("closePromptByClickoff", this.closePromptByClickoff ? "true" : "false");
		nsLocalStorage_save("frostedGlassBackground", this.frostedGlassBackground ? "true" : "false");
		nsLocalStorage_save("keyboardLayout", this.keyboardLayout);
		nsLocalStorage_save("bassOffset", String(this.bassOffset));
		nsLocalStorage_save("layout", this.layout);
		nsLocalStorage_save("colorTheme", this.colorTheme);
		nsLocalStorage_save("customTheme", this.customTheme!);
		nsLocalStorage_save("customTheme2", this.customTheme2!);
		nsLocalStorage_save("volume", String(this.volume));
		nsLocalStorage_save("visibleOctaves", String(this.visibleOctaves));
		
	}
}
