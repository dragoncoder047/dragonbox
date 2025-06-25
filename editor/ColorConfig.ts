// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { HTML } from "imperative-html/dist/esm/elements-strict";
import { Song } from "../synth/Song";
import { BeepBoxOption, Config, DictionaryArray, toNameMap } from "../synth/SynthConfig";
import { nsLocalStorage_get } from "./namespaced_localStorage";

import abyssboxClassicThemeCSS from "../data/themes/abyssbox_classic.css";
import abyssboxLightThemeCSS from "../data/themes/abyssbox_light.css";
import amoledDarkThemeCSS from "../data/themes/amoled_dark.css";
import autumnThemeCSS from "../data/themes/autumn.css";
import azurLaneThemeCSS from "../data/themes/azur_lane.css";
import beachcombingThemeCSS from "../data/themes/beachcombing.css";
import bluboxClassicThemeCSS from "../data/themes/blubox_classic.css";
import blutoniumThemeCSS from "../data/themes/blutonium.css";
import bruceboxThemeCSS from "../data/themes/brucebox.css";
import canyonThemeCSS from "../data/themes/canyon.css";
import cardboardboxClassicThemeCSS from "../data/themes/cardboardbox_classic.css";
import darkCompetitionThemeCSS from "../data/themes/dark_competition.css";
import dogebox2ThemeCSS from "../data/themes/dogebox2.css";
import dogeboxClassicThemeCSS from "../data/themes/dogebox_classic.css";
import dogeboxDarkThemeCSS from "../data/themes/dogebox_dark.css";
import energizedThemeCSS from "../data/themes/energized.css";
import fogboxThemeCSS from "../data/themes/fogbox.css";
import forestThemeCSS from "../data/themes/forest.css";
import foxboxThemeCSS from "../data/themes/foxbox.css";
import fruitThemeCSS from "../data/themes/fruit.css";
import fusionThemeCSS from "../data/themes/fusion.css";
import greyscaleThemeCSS from "../data/themes/greyscale.css";
import harryboxThemeCSS from "../data/themes/harrybox.css";
import inverseThemeCSS from "../data/themes/inverse.css";
import jummboxClassicThemeCSS from "../data/themes/jummbox_classic.css";
import jummboxLightThemeCSS from "../data/themes/jummbox_light.css";
import lightClassicThemeCSS from "../data/themes/light_classic.css";
import mainbox1ThemeCSS from "../data/themes/mainbox1.css";
import microboxThemeCSS from "../data/themes/microbox.css";
import midboxThemeCSS from "../data/themes/midbox.css";
import midnightThemeCSS from "../data/themes/midnight.css";
import modboxClassicThemeCSS from "../data/themes/modbox_classic.css";
import moonlightThemeCSS from "../data/themes/moonlight.css";
import neapolitanThemeCSS from "../data/themes/neapolitan.css";
import nebulaThemeCSS from "../data/themes/nebula.css";
import nepboxThemeCSS from "../data/themes/nepbox.css";
import nerdboxThemeCSS from "../data/themes/nerdbox.css";
import paandorasboxThemeCSS from "../data/themes/paandorasbox.css";
import polyThemeCSS from "../data/themes/poly.css";
import portalThemeCSS from "../data/themes/portal.css";
import roeThemeCSS from "../data/themes/roe.css";
import roeLightThemeCSS from "../data/themes/roe_light.css";
import sandboxClassicThemeCSS from "../data/themes/sandbox_classic.css";
import shitbox2ThemeCSS from "../data/themes/shitbox2.css";
import shitbox3ThemeCSS from "../data/themes/shitbox3.css";
import slarmoosboxThemeCSS from "../data/themes/slarmoosbox.css";
import slushieThemeCSS from "../data/themes/slushie.css";
import sunsetThemeCSS from "../data/themes/sunset.css";
import todboxDarkModeThemeCSS from "../data/themes/todbox_dark.css";
import toxicThemeCSS from "../data/themes/toxic.css";
import ultraboxDarkThemeCSS from "../data/themes/ultrabox_dark.css";
import violentVerdantThemeCSS from "../data/themes/violent_verdant.css";
import wackyboxThemeCSS from "../data/themes/wackybox.css";
import zefboxThemeCSS from "../data/themes/zefbox.css";

export interface ChannelColors extends BeepBoxOption {
    readonly secondaryChannel: string;
    readonly primaryChannel: string;
    readonly secondaryNote: string;
    readonly primaryNote: string;
}

export class ColorConfig {
    static colorLookup = new Map<number, ChannelColors>();
    static usesColorFormula = false;
    static readonly defaultTheme = "dark classic";
    static readonly themes: Record<string, string> = {
        "dark classic": ``, // why is the empty?????? is it the default?
        "dark competition": darkCompetitionThemeCSS,
        "light classic": lightClassicThemeCSS,
        "jummbox classic": jummboxClassicThemeCSS,
        "forest": forestThemeCSS,
        "canyon": canyonThemeCSS,
        "midnight": midnightThemeCSS,
        "jummbox light": jummboxLightThemeCSS,
        "amoled dark": amoledDarkThemeCSS,
        "beachcombing": beachcombingThemeCSS,
        "roe": roeThemeCSS,
        "moonlight": moonlightThemeCSS,
        "autumn": autumnThemeCSS,
        "fruit": fruitThemeCSS,
        "sunset": sunsetThemeCSS,
        "toxic": toxicThemeCSS,
        "violet verdant": violentVerdantThemeCSS,
        "portal": portalThemeCSS,
        "fusion": fusionThemeCSS,
        "inverse": inverseThemeCSS,
        "nebula": nebulaThemeCSS,
        "roe light": roeLightThemeCSS,
        "energized": energizedThemeCSS,
        "neapolitan": neapolitanThemeCSS,
        "poly": polyThemeCSS,
        "greyscale": greyscaleThemeCSS,
        "blutonium": blutoniumThemeCSS,
        "slushie": slushieThemeCSS,
        "ultrabox dark": ultraboxDarkThemeCSS,
        "modbox classic": modboxClassicThemeCSS,
        "zefbox": zefboxThemeCSS,
        "sandbox classic": sandboxClassicThemeCSS,
        "harrybox": harryboxThemeCSS,
        "brucebox": bruceboxThemeCSS,
        "shitbox 2.0": shitbox2ThemeCSS,
        "shitbox 3.0": shitbox3ThemeCSS,
        "nerdbox": nerdboxThemeCSS,
        "nepbox": nepboxThemeCSS,
        "cardboardbox classic": cardboardboxClassicThemeCSS,
        "blubox classic": bluboxClassicThemeCSS,
        "dogebox classic": dogeboxClassicThemeCSS,
        "dogebox dark": dogeboxDarkThemeCSS,
        "todbox dark mode": todboxDarkModeThemeCSS,
        "mainbox 1.0": mainbox1ThemeCSS,
        "fogbox": fogboxThemeCSS,
        "foxbox": foxboxThemeCSS,
        "wackybox": wackyboxThemeCSS,
        "microbox": microboxThemeCSS,
        "paandorasbox": paandorasboxThemeCSS,
        "midbox": midboxThemeCSS,
        "dogebox2": dogebox2ThemeCSS,
        "abyssbox classic": abyssboxClassicThemeCSS,
        "abyssbox light": abyssboxLightThemeCSS,
        "slarmoosbox": slarmoosboxThemeCSS,
        "azur lane": azurLaneThemeCSS,
        "custom": `${nsLocalStorage_get("customColors") || `:root {  }`}`,
    };

    static readonly pageMargin = "var(--page-margin, black)";
    static readonly editorBackground = "var(--editor-background, black)";
    static readonly hoverPreview = "var(--hover-preview, white)";
    static readonly playhead = "var(--playhead, white)";
    static readonly primaryText = "var(--primary-text, white)";
    static readonly secondaryText = "var(--secondary-text, #999)";
    static readonly invertedText = "var(--inverted-text, black)";
    static readonly textSelection = "var(--text-selection, rgba(119,68,255,0.99))";
    static readonly boxSelectionFill = "var(--box-selection-fill, rgba(255,255,255,0.2))";
    static readonly loopAccent = "var(--loop-accent, #74f)";
    static readonly linkAccent = "var(--link-accent, #98f)";
    static readonly uiWidgetBackground = "var(--ui-widget-background, #444)";
    static readonly uiWidgetFocus = "var(--ui-widget-focus, #777)";
    static readonly pitchBackground = "var(--pitch-background, #444)";
    static readonly tonic = "var(--tonic, #864)";
    static readonly fifthNote = "var(--fifth-note, #468)";
    static readonly whitePianoKey = "var(--white-piano-key, #bbb)";
    static readonly blackPianoKey = "var(--black-piano-key, #444)";
    static readonly whitePianoKeyText = "var(--white-piano-key-text, #131200)";
    static readonly blackPianoKeyText = "var(--black-piano-key-text, #fff)";
    //public static readonly oscilloscopeLineL = "var(--oscilloscope-line-L, var(--primary-text, white))";
    //public static readonly oscilloscopeLineR = "var(--oscilloscope-line-R, var(--text-selection, rgba(119,68,255,0.99)))";
    // modTitle can stay uncommented until it's used somwhere that's not index.html
    // public static readonly modTitle = "var(--mod-title)";
    static readonly useColorFormula = "var(--use-color-formula, false)";
    // public static readonly pitchLimit = "var(--pitch-channel-limit)";
    // public static readonly noiseLimit = "var(--noise-channel-limit)";
    // public static readonly modLimit = "var(--mod-channel-limit)";
    // public static readonly colorFormulaPitchLimit = "var(--formula-pitch-channel-limit)";
    // public static readonly colorFormulaNoiseLimit = "var(--formula-noise-channel-limit)";
    // public static readonly colorFormulaModLimit = "var(--formula-mod-channel-limit)";
    static readonly pitchSecondaryChannelHue = "var(--pitch-secondary-channel-hue)";
    static readonly pitchSecondaryChannelHueScale = "var(--pitch-secondary-channel-hue-scale)";
    static readonly pitchSecondaryChannelSat = "var(--pitch-secondary-channel-sat)";
    static readonly pitchSecondaryChannelSatScale = "var(--pitch-secondary-channel-sat-scale)";
    static readonly pitchSecondaryChannelLum = "var(--pitch-secondary-channel-lum)";
    static readonly pitchSecondaryChannelLumScale = "var(--pitch-secondary-channel-lum-scale)";
    static readonly pitchPrimaryChannelHue = "var(--pitch-primary-channel-hue)";
    static readonly pitchPrimaryChannelHueScale = "var(--pitch-primary-channel-hue-scale)";
    static readonly pitchPrimaryChannelSat = "var(--pitch-primary-channel-sat)";
    static readonly pitchPrimaryChannelSatScale = "var(--pitch-primary-channel-sat-scale)";
    static readonly pitchPrimaryChannelLum = "var(--pitch-primary-channel-lum)";
    static readonly pitchPrimaryChannelLumScale = "var(--pitch-primary-channel-lum-scale)";
    static readonly pitchSecondaryNoteHue = "var(--pitch-secondary-note-hue)";
    static readonly pitchSecondaryNoteHueScale = "var(--pitch-secondary-note-hue-scale)";
    static readonly pitchSecondaryNoteSat = "var(--pitch-secondary-note-sat)";
    static readonly pitchSecondaryNoteSatScale = "var(--pitch-secondary-note-sat-scale)";
    static readonly pitchSecondaryNoteLum = "var(--pitch-secondary-note-lum)";
    static readonly pitchSecondaryNoteLumScale = "var(--pitch-secondary-note-lum-scale)";
    static readonly pitchPrimaryNoteHue = "var(--pitch-primary-note-hue)";
    static readonly pitchPrimaryNoteHueScale = "var(--pitch-primary-note-hue-scale)";
    static readonly pitchPrimaryNoteSat = "var(--pitch-primary-note-sat)";
    static readonly pitchPrimaryNoteSatScale = "var(--pitch-primary-note-sat-scale)";
    static readonly pitchPrimaryNoteLum = "var(--pitch-primary-note-lum)";
    static readonly pitchPrimaryNoteLumScale = "var(--pitch-primary-note-lum-scale)";
    static readonly modSecondaryChannelHue = "var(--mod-secondary-channel-hue)";
    static readonly modSecondaryChannelHueScale = "var(--mod-secondary-channel-hue-scale)";
    static readonly modSecondaryChannelSat = "var(--mod-secondary-channel-sat)";
    static readonly modSecondaryChannelSatScale = "var(--mod-secondary-channel-sat-scale)";
    static readonly modSecondaryChannelLum = "var(--mod-secondary-channel-lum)";
    static readonly modSecondaryChannelLumScale = "var(--mod-secondary-channel-lum-scale)";
    static readonly modPrimaryChannelHue = "var(--mod-primary-channel-hue)";
    static readonly modPrimaryChannelHueScale = "var(--mod-primary-channel-hue-scale)";
    static readonly modPrimaryChannelSat = "var(--mod-primary-channel-sat)";
    static readonly modPrimaryChannelSatScale = "var(--mod-primary-channel-sat-scale)";
    static readonly modPrimaryChannelLum = "var(--mod-primary-channel-lum)";
    static readonly modPrimaryChannelLumScale = "var(--mod-primary-channel-lum-scale)";
    static readonly modSecondaryNoteHue = "var(--mod-secondary-note-hue)";
    static readonly modSecondaryNoteHueScale = "var(--mod-secondary-note-hue-scale)";
    static readonly modSecondaryNoteSat = "var(--mod-secondary-note-sat)";
    static readonly modSecondaryNoteSatScale = "var(--mod-secondary-note-sat-scale)";
    static readonly modSecondaryNoteLum = "var(--mod-secondary-note-lum)";
    static readonly modSecondaryNoteLumScale = "var(--mod-secondary-note-lum-scale)";
    static readonly modPrimaryNoteHue = "var(--mod-primary-note-hue)";
    static readonly modPrimaryNoteHueScale = "var(--mod-primary-note-hue-scale)";
    static readonly modPrimaryNoteSat = "var(--mod-primary-note-sat)";
    static readonly modPrimaryNoteSatScale = "var(--mod-primary-note-sat-scale)";
    static readonly modPrimaryNoteLum = "var(--mod-primary-note-lum)";
    static readonly modPrimaryNoteLumScale = "var(--mod-primary-note-lum-scale)";
    static readonly noiseSecondaryChannelHue = "var(--noise-secondary-channel-hue)";
    static readonly noiseSecondaryChannelHueScale = "var(--noise-secondary-channel-hue-scale)";
    static readonly noiseSecondaryChannelSat = "var(--noise-secondary-channel-sat)";
    static readonly noiseSecondaryChannelSatScale = "var(--noise-secondary-channel-sat-scale)";
    static readonly noiseSecondaryChannelLum = "var(--noise-secondary-channel-lum)";
    static readonly noiseSecondaryChannelLumScale = "var(--noise-secondary-channel-lum-scale)";
    static readonly noisePrimaryChannelHue = "var(--noise-primary-channel-hue)";
    static readonly noisePrimaryChannelHueScale = "var(--noise-primary-channel-hue-scale)";
    static readonly noisePrimaryChannelSat = "var(--noise-primary-channel-sat)";
    static readonly noisePrimaryChannelSatScale = "var(--noise-primary-channel-sat-scale)";
    static readonly noisePrimaryChannelLum = "var(--noise-primary-channel-lum)";
    static readonly noisePrimaryChannelLumScale = "var(--noise-primary-channel-lum-scale)";
    static readonly noiseSecondaryNoteHue = "var(--noise-secondary-note-hue)";
    static readonly noiseSecondaryNoteHueScale = "var(--noise-secondary-note-hue-scale)";
    static readonly noiseSecondaryNoteSat = "var(--noise-secondary-note-sat)";
    static readonly noiseSecondaryNoteSatScale = "var(--noise-secondary-note-sat-scale)";
    static readonly noiseSecondaryNoteLum = "var(--noise-secondary-note-lum)";
    static readonly noiseSecondaryNoteLumScale = "var(--noise-secondary-note-lum-scale)";
    static readonly noisePrimaryNoteHue = "var(--noise-primary-note-hue)";
    static readonly noisePrimaryNoteHueScale = "var(--noise-primary-note-hue-scale)";
    static readonly noisePrimaryNoteSat = "var(--noise-primary-note-sat)";
    static readonly noisePrimaryNoteSatScale = "var(--noise-primary-note-sat-scale)";
    static readonly noisePrimaryNoteLum = "var(--noise-primary-note-lum)";
    static readonly noisePrimaryNoteLumScale = "var(--noise-primary-note-lum-scale)";
    static readonly trackEditorBgPitch = "var(--track-editor-bg-pitch, #444)";
    static readonly trackEditorBgPitchDim = "var(--track-editor-bg-pitch-dim, #333)";
    static readonly trackEditorBgNoise = "var(--track-editor-bg-noise, #444)";
    static readonly trackEditorBgNoiseDim = "var(--track-editor-bg-noise-dim, #333)";
    static readonly trackEditorBgMod = "var(--track-editor-bg-mod, #234)";
    static readonly trackEditorBgModDim = "var(--track-editor-bg-mod-dim, #123)";
    static readonly multiplicativeModSlider = "var(--multiplicative-mod-slider, #456;)";
    static readonly overwritingModSlider = "var(--overwriting-mod-slider, #654)";
    static readonly indicatorPrimary = "var(--indicator-primary, #74f)";
    static readonly indicatorSecondary = "var(--indicator-secondary, #444)";
    static readonly select2OptGroup = "var(--select2-opt-group, #585858)";
    static readonly inputBoxOutline = "var(--input-box-outline, #333)";
    static readonly muteButtonNormal = "var(--mute-button-normal, #ffa033)";
    static readonly muteButtonMod = "var(--mute-button-mod, #9a6bff)";
    static readonly modLabelPrimary = "var(--mod-label-primary, #999)";
    static readonly modLabelSecondaryText = "var(--mod-label-secondary-text, #333)";
    static readonly modLabelPrimaryText = "var(--mod-label-primary-text, black)";
    static readonly disabledNotePrimary = "var(--disabled-note-primary, #999)";
    static readonly disabledNoteSecondary = "var(--disabled-note-secondary, #666)";

    static c_pitchSecondaryChannelHue = 0;
    static c_pitchSecondaryChannelHueScale = 0;
    static c_pitchSecondaryChannelSat = 0;
    static c_pitchSecondaryChannelSatScale = 0;
    static c_pitchSecondaryChannelLum = 0;
    static c_pitchSecondaryChannelLumScale = 0;
    static c_pitchPrimaryChannelHue = 0;
    static c_pitchPrimaryChannelHueScale = 0;
    static c_pitchPrimaryChannelSat = 0;
    static c_pitchPrimaryChannelSatScale = 0;
    static c_pitchPrimaryChannelLum = 0;
    static c_pitchPrimaryChannelLumScale = 0;
    static c_pitchSecondaryNoteHue = 0;
    static c_pitchSecondaryNoteHueScale = 0;
    static c_pitchSecondaryNoteSat = 0;
    static c_pitchSecondaryNoteSatScale = 0;
    static c_pitchSecondaryNoteLum = 0;
    static c_pitchSecondaryNoteLumScale = 0;
    static c_pitchPrimaryNoteHue = 0;
    static c_pitchPrimaryNoteHueScale = 0;
    static c_pitchPrimaryNoteSat = 0;
    static c_pitchPrimaryNoteSatScale = 0;
    static c_pitchPrimaryNoteLum = 0;
    static c_pitchPrimaryNoteLumScale = 0;
    static c_modSecondaryChannelHue = 0;
    static c_modSecondaryChannelHueScale = 0;
    static c_modSecondaryChannelSat = 0;
    static c_modSecondaryChannelSatScale = 0;
    static c_modSecondaryChannelLum = 0;
    static c_modSecondaryChannelLumScale = 0;
    static c_modPrimaryChannelHue = 0;
    static c_modPrimaryChannelHueScale = 0;
    static c_modPrimaryChannelSat = 0;
    static c_modPrimaryChannelSatScale = 0;
    static c_modPrimaryChannelLum = 0;
    static c_modPrimaryChannelLumScale = 0;
    static c_modSecondaryNoteHue = 0;
    static c_modSecondaryNoteHueScale = 0;
    static c_modSecondaryNoteSat = 0;
    static c_modSecondaryNoteSatScale = 0;
    static c_modSecondaryNoteLum = 0;
    static c_modSecondaryNoteLumScale = 0;
    static c_modPrimaryNoteHue = 0;
    static c_modPrimaryNoteHueScale = 0;
    static c_modPrimaryNoteSat = 0;
    static c_modPrimaryNoteSatScale = 0;
    static c_modPrimaryNoteLum = 0;
    static c_modPrimaryNoteLumScale = 0;
    static c_noiseSecondaryChannelHue = 0;
    static c_noiseSecondaryChannelHueScale = 0;
    static c_noiseSecondaryChannelSat = 0;
    static c_noiseSecondaryChannelSatScale = 0;
    static c_noiseSecondaryChannelLum = 0;
    static c_noiseSecondaryChannelLumScale = 0;
    static c_noisePrimaryChannelHue = 0;
    static c_noisePrimaryChannelHueScale = 0;
    static c_noisePrimaryChannelSat = 0;
    static c_noisePrimaryChannelSatScale = 0;
    static c_noisePrimaryChannelLum = 0;
    static c_noisePrimaryChannelLumScale = 0;
    static c_noiseSecondaryNoteHue = 0;
    static c_noiseSecondaryNoteHueScale = 0;
    static c_noiseSecondaryNoteSat = 0;
    static c_noiseSecondaryNoteSatScale = 0;
    static c_noiseSecondaryNoteLum = 0;
    static c_noiseSecondaryNoteLumScale = 0;
    static c_noisePrimaryNoteHue = 0;
    static c_noisePrimaryNoteHueScale = 0;
    static c_noisePrimaryNoteSat = 0;
    static c_noisePrimaryNoteSatScale = 0;
    static c_noisePrimaryNoteLum = 0;
    static c_noisePrimaryNoteLumScale = 0;

    static c_pitchChannelCountOverride = 40;
    static c_noiseChannelCountOverride = 16;
    static c_modChannelCountOverride = 12;

    static c_pitchLimit = 1;
    static c_noiseLimit = 1;
    static c_modLimit = 1;
    static c_colorFormulaPitchLimit = 1;
    static c_colorFormulaNoiseLimit = 1;
    static c_colorFormulaModLimit = 1;

    static c_invertedText = "";
    static c_trackEditorBgNoiseDim = "";
    static c_trackEditorBgNoise = "";
    static c_trackEditorBgModDim = "";
    static c_trackEditorBgMod = "";
    static c_trackEditorBgPitchDim = "";
    static c_trackEditorBgPitch = "";

    static readonly pitchChannels: DictionaryArray<ChannelColors> = toNameMap([
        {
            name: "pitch1", // cyan
            secondaryChannel: "var(--pitch1-secondary-channel, #0099A1)",
            primaryChannel: "var(--pitch1-primary-channel, #25F3FF)",
            secondaryNote: "var(--pitch1-secondary-note, #00BDC7)",
            primaryNote: "var(--pitch1-primary-note, #92F9FF)",
        }, {
            name: "pitch2", // yellow
            secondaryChannel: "var(--pitch2-secondary-channel, #A1A100)",
            primaryChannel: "var(--pitch2-primary-channel, #FFFF25)",
            secondaryNote: "var(--pitch2-secondary-note, #C7C700)",
            primaryNote: "var(--pitch2-primary-note, #FFFF92)",
        }, {
            name: "pitch3", // orange
            secondaryChannel: "var(--pitch3-secondary-channel, #C75000)",
            primaryChannel: "var(--pitch3-primary-channel, #FF9752)",
            secondaryNote: "var(--pitch3-secondary-note, #FF771C)",
            primaryNote: "var(--pitch3-primary-note, #FFCDAB)",
        }, {
            name: "pitch4", // green
            secondaryChannel: "var(--pitch4-secondary-channel, #00A100)",
            primaryChannel: "var(--pitch4-primary-channel, #50FF50)",
            secondaryNote: "var(--pitch4-secondary-note, #00C700)",
            primaryNote: "var(--pitch4-primary-note, #A0FFA0)",
        }, {
            name: "pitch5", // magenta
            secondaryChannel: "var(--pitch5-secondary-channel, #D020D0)",
            primaryChannel: "var(--pitch5-primary-channel, #FF90FF)",
            secondaryNote: "var(--pitch5-secondary-note, #E040E0)",
            primaryNote: "var(--pitch5-primary-note, #FFC0FF)",
        }, {
            name: "pitch6", // blue
            secondaryChannel: "var(--pitch6-secondary-channel, #7777B0)",
            primaryChannel: "var(--pitch6-primary-channel, #A0A0FF)",
            secondaryNote: "var(--pitch6-secondary-note, #8888D0)",
            primaryNote: "var(--pitch6-primary-note, #D0D0FF)",
        }, {
            name: "pitch7", // olive
            secondaryChannel: "var(--pitch7-secondary-channel, #8AA100)",
            primaryChannel: "var(--pitch7-primary-channel, #DEFF25)",
            secondaryNote: "var(--pitch7-secondary-note, #AAC700)",
            primaryNote: "var(--pitch7-primary-note, #E6FF92)",
        }, {
            name: "pitch8", // red
            secondaryChannel: "var(--pitch8-secondary-channel, #DF0019)",
            primaryChannel: "var(--pitch8-primary-channel, #FF98A4)",
            secondaryNote: "var(--pitch8-secondary-note, #FF4E63)",
            primaryNote: "var(--pitch8-primary-note, #FFB2BB)",
        }, {
            name: "pitch9", // teal
            secondaryChannel: "var(--pitch9-secondary-channel, #00A170)",
            primaryChannel: "var(--pitch9-primary-channel, #50FFC9)",
            secondaryNote: "var(--pitch9-secondary-note, #00C78A)",
            primaryNote: "var(--pitch9-primary-note, #83FFD9)",
        }, {
            name: "pitch10", // purple
            secondaryChannel: "var(--pitch10-secondary-channel, #A11FFF)",
            primaryChannel: "var(--pitch10-primary-channel, #CE8BFF)",
            secondaryNote: "var(--pitch10-secondary-note, #B757FF)",
            primaryNote: "var(--pitch10-primary-note, #DFACFF)",
        },
    ]);
    static readonly noiseChannels: DictionaryArray<ChannelColors> = toNameMap([
        {
            name: "noise1", // gray
            secondaryChannel: "var(--noise1-secondary-channel, #6F6F6F)",
            primaryChannel: "var(--noise1-primary-channel, #AAAAAA)",
            secondaryNote: "var(--noise1-secondary-note, #A7A7A7)",
            primaryNote: "var(--noise1-primary-note, #E0E0E0)",
        }, {
            name: "noise2", // brown
            secondaryChannel: "var(--noise2-secondary-channel, #996633)",
            primaryChannel: "var(--noise2-primary-channel, #DDAA77)",
            secondaryNote: "var(--noise2-secondary-note, #CC9966)",
            primaryNote: "var(--noise2-primary-note, #F0D0BB)",
        }, {
            name: "noise3", // azure
            secondaryChannel: "var(--noise3-secondary-channel, #4A6D8F)",
            primaryChannel: "var(--noise3-primary-channel, #77AADD)",
            secondaryNote: "var(--noise3-secondary-note, #6F9FCF)",
            primaryNote: "var(--noise3-primary-note, #BBD7FF)",
        }, {
            name: "noise4", // purple
            secondaryChannel: "var(--noise4-secondary-channel, #7A4F9A)",
            primaryChannel: "var(--noise4-primary-channel, #AF82D2)",
            secondaryNote: "var(--noise4-secondary-note, #9E71C1)",
            primaryNote: "var(--noise4-primary-note, #D4C1EA)",
        }, {
            name: "noise5", // sage
            secondaryChannel: "var(--noise5-secondary-channel, #607837)",
            primaryChannel: "var(--noise5-primary-channel, #A2BB77)",
            secondaryNote: "var(--noise5-secondary-note, #91AA66)",
            primaryNote: "var(--noise5-primary-note, #C5E2B2)",
        },
    ]);
    static readonly modChannels: DictionaryArray<ChannelColors> = toNameMap([
        {
            name: "mod1",
            secondaryChannel: "var(--mod1-secondary-channel, #339955)",
            primaryChannel: "var(--mod1-primary-channel, #77fc55)",
            secondaryNote: "var(--mod1-secondary-note, #77ff8a)",
            primaryNote: "var(--mod1-primary-note, #cdffee)",
        }, {
            name: "mod2",
            secondaryChannel: "var(--mod2-secondary-channel, #993355)",
            primaryChannel: "var(--mod2-primary-channel, #f04960)",
            secondaryNote: "var(--mod2-secondary-note, #f057a0)",
            primaryNote: "var(--mod2-primary-note, #ffb8de)",
        }, {
            name: "mod3",
            secondaryChannel: "var(--mod3-secondary-channel, #553399)",
            primaryChannel: "var(--mod3-primary-channel, #8855fc)",
            secondaryNote: "var(--mod3-secondary-note, #aa64ff)",
            primaryNote: "var(--mod3-primary-note, #f8ddff)",
        }, {
            name: "mod4",
            secondaryChannel: "var(--mod4-secondary-channel, #a86436)",
            primaryChannel: "var(--mod4-primary-channel, #c8a825)",
            secondaryNote: "var(--mod4-secondary-note, #e8ba46)",
            primaryNote: "var(--mod4-primary-note, #fff6d3)",
        },
    ]);

    static resetColors() {
        this.colorLookup.clear();
    }

    static getArbitaryChannelColor(type: string, channel: number): ChannelColors {

        if (!this.usesColorFormula) {
            let base: ChannelColors;
            switch (type) {
                case ("noise"): {
                    base = ColorConfig.noiseChannels[(channel % this.c_noiseLimit) % ColorConfig.noiseChannels.length];
                    break;
                }
                case ("mod"): {
                    base = ColorConfig.modChannels[(channel % this.c_modLimit) % ColorConfig.modChannels.length];
                    break;
                }
                case ("pitch"):
                default: {
                    base = ColorConfig.pitchChannels[(channel % this.c_pitchLimit) % ColorConfig.pitchChannels.length];
                    break;
                }
            }
            var regex = /\(([^\,)]+)/;
            let newChannelSecondary = ColorConfig.getComputed((regex.exec(base.secondaryChannel) as RegExpExecArray)[1] as string);
            let newChannelPrimary = ColorConfig.getComputed((regex.exec(base.primaryChannel) as RegExpExecArray)[1] as string);
            let newNoteSecondary = ColorConfig.getComputed((regex.exec(base.secondaryNote) as RegExpExecArray)[1] as string);
            let newNotePrimary = ColorConfig.getComputed((regex.exec(base.primaryNote) as RegExpExecArray)[1] as string);
            return <ChannelColors>{ secondaryChannel: newChannelSecondary, primaryChannel: newChannelPrimary, secondaryNote: newNoteSecondary, primaryNote: newNotePrimary };
        }
        let colorFormulaPitchLimit = this.c_colorFormulaPitchLimit;
        let colorFormulaNoiseLimit = this.c_colorFormulaNoiseLimit;
        let colorFormulaModLimit = this.c_colorFormulaModLimit;
        switch (type) {
            case ("noise"): {
                // Noise formula

                let newChannelSecondary = "hsl(" + ((this.c_noiseSecondaryChannelHue + ((channel * this.c_noiseSecondaryChannelHueScale) / this.c_noiseChannelCountOverride) * 256) % colorFormulaNoiseLimit) + ","
                    + (this.c_noiseSecondaryChannelSat + channel * this.c_noiseSecondaryChannelSatScale) + "%,"
                    + (this.c_noiseSecondaryChannelLum + channel * this.c_noiseSecondaryChannelLumScale) + "%)";
                let newChannelPrimary = "hsl(" + ((this.c_noisePrimaryChannelHue + ((channel * this.c_noisePrimaryChannelHueScale) / this.c_noiseChannelCountOverride) * 256) % colorFormulaNoiseLimit) + ","
                    + (this.c_noisePrimaryChannelSat + channel * this.c_noisePrimaryChannelSatScale) + "%,"
                    + (this.c_noisePrimaryChannelLum + channel * this.c_noisePrimaryChannelLumScale) + "%)";
                let newNoteSecondary = "hsl(" + ((this.c_noiseSecondaryNoteHue + ((channel * this.c_noiseSecondaryNoteHueScale) / this.c_noiseChannelCountOverride) * 256) % colorFormulaNoiseLimit) + ","
                    + (this.c_noiseSecondaryNoteSat + channel * this.c_noiseSecondaryNoteSatScale) + "%,"
                    + (this.c_noiseSecondaryNoteLum + channel * this.c_noiseSecondaryNoteLumScale) + "%)";
                let newNotePrimary = "hsl(" + ((this.c_noisePrimaryNoteHue + ((channel * this.c_noisePrimaryNoteHueScale) / this.c_noiseChannelCountOverride) * 256) % colorFormulaNoiseLimit) + ","
                    + (this.c_noisePrimaryNoteSat + channel * this.c_noisePrimaryNoteSatScale) + "%,"
                    + (this.c_noisePrimaryNoteLum + channel * this.c_noisePrimaryNoteLumScale) + "%)";

                let newChannelColors = <ChannelColors>{ secondaryChannel: newChannelSecondary, primaryChannel: newChannelPrimary, secondaryNote: newNoteSecondary, primaryNote: newNotePrimary };
                return newChannelColors;
            } case ("mod"): {
                // Mod formula

                let newChannelSecondary = "hsl(" + ((this.c_modSecondaryChannelHue + ((channel * this.c_modSecondaryChannelHueScale) / this.c_modChannelCountOverride) * 256) % colorFormulaModLimit) + ","
                    + (this.c_modSecondaryChannelSat + channel * this.c_modSecondaryChannelSatScale) + "%,"
                    + (this.c_modSecondaryChannelLum + channel * this.c_modSecondaryChannelLumScale) + "%)";
                let newChannelPrimary = "hsl(" + ((this.c_modPrimaryChannelHue + ((channel * this.c_modPrimaryChannelHueScale) / this.c_modChannelCountOverride) * 256) % colorFormulaModLimit) + ","
                    + (this.c_modPrimaryChannelSat + channel * this.c_modPrimaryChannelSatScale) + "%,"
                    + (this.c_modPrimaryChannelLum + channel * this.c_modPrimaryChannelLumScale) + "%)";
                let newNoteSecondary = "hsl(" + ((this.c_modSecondaryNoteHue + ((channel * this.c_modSecondaryNoteHueScale) / this.c_modChannelCountOverride) * 256) % colorFormulaModLimit) + ","
                    + (this.c_modSecondaryNoteSat + channel * this.c_modSecondaryNoteSatScale) + "%,"
                    + (this.c_modSecondaryNoteLum + channel * this.c_modSecondaryNoteLumScale) + "%)";
                let newNotePrimary = "hsl(" + ((this.c_modPrimaryNoteHue + ((channel * this.c_modPrimaryNoteHueScale) / this.c_modChannelCountOverride) * 256) % colorFormulaModLimit) + ","
                    + (this.c_modPrimaryNoteSat + channel * this.c_modPrimaryNoteSatScale) + "%,"
                    + (this.c_modPrimaryNoteLum + channel * this.c_modPrimaryNoteLumScale) + "%)";

                let newChannelColors = <ChannelColors>{ secondaryChannel: newChannelSecondary, primaryChannel: newChannelPrimary, secondaryNote: newNoteSecondary, primaryNote: newNotePrimary };
                return newChannelColors;
            }
            case ("pitch"):
            default: {
                // Pitch formula

                let newChannelSecondary = "hsl(" + ((this.c_pitchSecondaryChannelHue + (channel * this.c_pitchSecondaryChannelHueScale / this.c_pitchChannelCountOverride) * 256) % colorFormulaPitchLimit) + ","
                    + (this.c_pitchSecondaryChannelSat * (1 - (this.c_pitchSecondaryChannelSatScale * Math.floor(channel / 7)))) + "%,"
                    + (this.c_pitchSecondaryChannelLum * (1 - (this.c_pitchSecondaryChannelLumScale * Math.floor(channel / 7)))) + "%)";
                let newChannelPrimary = "hsl(" + ((this.c_pitchPrimaryChannelHue + (channel * this.c_pitchPrimaryChannelHueScale / this.c_pitchChannelCountOverride) * 256) % colorFormulaPitchLimit) + ","
                    + (this.c_pitchPrimaryChannelSat * (1 - (this.c_pitchPrimaryChannelSatScale * Math.floor(channel / 7)))) + "%,"
                    + (this.c_pitchPrimaryChannelLum * (1 - (this.c_pitchPrimaryChannelLumScale * Math.floor(channel / 7)))) + "%)";
                let newNoteSecondary = "hsl(" + ((this.c_pitchSecondaryNoteHue + (channel * this.c_pitchSecondaryNoteHueScale / this.c_pitchChannelCountOverride) * 256) % colorFormulaPitchLimit) + ","
                    + (this.c_pitchSecondaryNoteSat * (1 - (this.c_pitchSecondaryNoteSatScale * Math.floor(channel / 7)))) + "%,"
                    + (this.c_pitchSecondaryNoteLum * (1 - (this.c_pitchSecondaryNoteLumScale * Math.floor(channel / 7)))) + "%)";
                let newNotePrimary = "hsl(" + ((this.c_pitchPrimaryNoteHue + (channel * this.c_pitchPrimaryNoteHueScale / this.c_pitchChannelCountOverride) * 256) % colorFormulaPitchLimit) + ","
                    + (this.c_pitchPrimaryNoteSat * (1 - (this.c_pitchPrimaryNoteSatScale * Math.floor(channel / 7)))) + "%,"
                    + (this.c_pitchPrimaryNoteLum * (1 - (this.c_pitchPrimaryNoteLumScale * Math.floor(channel / 7)))) + "%)";

                let newChannelColors = <ChannelColors>{ secondaryChannel: newChannelSecondary, primaryChannel: newChannelPrimary, secondaryNote: newNoteSecondary, primaryNote: newNotePrimary };
                return newChannelColors;
            }
        }
    }

    // Same as below, but won't return var colors
    static getComputedChannelColor(song: Song, color: number, channel: number, useFixedOrder: boolean): ChannelColors {
        if (!this.usesColorFormula) {
            let base = ColorConfig.getChannelColor(song, color, channel, useFixedOrder);
            // Trim away "var(...)"
            var regex = /\(([^\,)]+)/;
            let newChannelSecondary = ColorConfig.getComputed((regex.exec(base.secondaryChannel) as RegExpExecArray)[1] as string);
            let newChannelPrimary = ColorConfig.getComputed((regex.exec(base.primaryChannel) as RegExpExecArray)[1] as string);
            let newNoteSecondary = ColorConfig.getComputed((regex.exec(base.secondaryNote) as RegExpExecArray)[1] as string);
            let newNotePrimary = ColorConfig.getComputed((regex.exec(base.primaryNote) as RegExpExecArray)[1] as string);
            return <ChannelColors>{ secondaryChannel: newChannelSecondary, primaryChannel: newChannelPrimary, secondaryNote: newNoteSecondary, primaryNote: newNotePrimary };
        }
        else {
            return ColorConfig.getChannelColor(song, color, channel, useFixedOrder);
        }
    };

    static getChannelColor(song: Song, color: number, channel: number, useFixedOrder: boolean): ChannelColors {
        if (!this.usesColorFormula) {
            // Set colors, not defined by formula
            if (!useFixedOrder) {
                if (channel < song.pitchChannelCount) {
                    return ColorConfig.pitchChannels[(color % this.c_pitchLimit) % ColorConfig.pitchChannels.length];
                } else if (channel < song.pitchChannelCount + song.noiseChannelCount) {
                    return ColorConfig.noiseChannels[(color % this.c_noiseLimit) % ColorConfig.noiseChannels.length];
                } else {
                    return ColorConfig.modChannels[(color % this.c_modLimit) % ColorConfig.modChannels.length];
                }
            }
            else {
                if (channel < song.pitchChannelCount) {
                    return ColorConfig.pitchChannels[(channel % this.c_pitchLimit) % ColorConfig.pitchChannels.length];
                } else if (channel < song.pitchChannelCount + song.noiseChannelCount) {
                    return ColorConfig.noiseChannels[((channel - song.pitchChannelCount) % this.c_noiseLimit) % ColorConfig.noiseChannels.length];
                } else {
                    return ColorConfig.modChannels[((channel - song.pitchChannelCount - song.noiseChannelCount) % this.c_modLimit) % ColorConfig.modChannels.length];
                }
            }
        }
        else {
            if (useFixedOrder) color = channel;
            // Determine if color is cached
            if (ColorConfig.colorLookup.has(color)) {
                return ColorConfig.colorLookup.get(color) as ChannelColors;
            }
            else {
                // Formulaic color definition
                let colorFormulaPitchLimit = this.c_colorFormulaPitchLimit;
                let colorFormulaNoiseLimit = this.c_colorFormulaNoiseLimit;
                let colorFormulaModLimit = this.c_colorFormulaModLimit;
                if (channel < song.pitchChannelCount) {
                    // Pitch formula

                    let newChannelSecondary = "hsl(" + ((this.c_pitchSecondaryChannelHue + (color * this.c_pitchSecondaryChannelHueScale / this.c_pitchChannelCountOverride) * 256) % colorFormulaPitchLimit) + ","
                        + (this.c_pitchSecondaryChannelSat * (1 - (this.c_pitchSecondaryChannelSatScale * Math.floor(color / 9)))) + "%,"
                        + (this.c_pitchSecondaryChannelLum * (1 - (this.c_pitchSecondaryChannelLumScale * Math.floor(color / 9)))) + "%)";
                    let newChannelPrimary = "hsl(" + ((this.c_pitchPrimaryChannelHue + (color * this.c_pitchPrimaryChannelHueScale / this.c_pitchChannelCountOverride) * 256) % colorFormulaPitchLimit) + ","
                        + (this.c_pitchPrimaryChannelSat * (1 - (this.c_pitchPrimaryChannelSatScale * Math.floor(color / 9)))) + "%,"
                        + (this.c_pitchPrimaryChannelLum * (1 - (this.c_pitchPrimaryChannelLumScale * Math.floor(color / 9)))) + "%)";
                    let newNoteSecondary = "hsl(" + ((this.c_pitchSecondaryNoteHue + (color * this.c_pitchSecondaryNoteHueScale / this.c_pitchChannelCountOverride) * 256) % colorFormulaPitchLimit) + ","
                        + (this.c_pitchSecondaryNoteSat * (1 - (this.c_pitchSecondaryNoteSatScale * Math.floor(color / 9)))) + "%,"
                        + (this.c_pitchSecondaryNoteLum * (1 - (this.c_pitchSecondaryNoteLumScale * Math.floor(color / 9)))) + "%)";
                    let newNotePrimary = "hsl(" + ((this.c_pitchPrimaryNoteHue + (color * this.c_pitchPrimaryNoteHueScale / this.c_pitchChannelCountOverride) * 256) % colorFormulaPitchLimit) + ","
                        + (this.c_pitchPrimaryNoteSat * (1 - (this.c_pitchPrimaryNoteSatScale * Math.floor(color / 9)))) + "%,"
                        + (this.c_pitchPrimaryNoteLum * (1 - (this.c_pitchPrimaryNoteLumScale * Math.floor(color / 9)))) + "%)";

                    let newChannelColors = <ChannelColors>{ secondaryChannel: newChannelSecondary, primaryChannel: newChannelPrimary, secondaryNote: newNoteSecondary, primaryNote: newNotePrimary };
                    ColorConfig.colorLookup.set(color, newChannelColors);
                    return newChannelColors;

                }
                else if (channel < song.pitchChannelCount + song.noiseChannelCount) {
                    // Noise formula

                    let newChannelSecondary = "hsl(" + ((this.c_noiseSecondaryChannelHue + (((color - song.pitchChannelCount) * this.c_noiseSecondaryChannelHueScale) / this.c_noiseChannelCountOverride) * 256) % colorFormulaNoiseLimit) + ","
                        + (this.c_noiseSecondaryChannelSat + color * this.c_noiseSecondaryChannelSatScale) + "%,"
                        + (this.c_noiseSecondaryChannelLum + color * this.c_noiseSecondaryChannelLumScale) + "%)";
                    let newChannelPrimary = "hsl(" + ((this.c_noisePrimaryChannelHue + (((color - song.pitchChannelCount) * this.c_noisePrimaryChannelHueScale) / this.c_noiseChannelCountOverride) * 256) % colorFormulaNoiseLimit) + ","
                        + (this.c_noisePrimaryChannelSat + color * this.c_noisePrimaryChannelSatScale) + "%,"
                        + (this.c_noisePrimaryChannelLum + color * this.c_noisePrimaryChannelLumScale) + "%)";
                    let newNoteSecondary = "hsl(" + ((this.c_noiseSecondaryNoteHue + (((color - song.pitchChannelCount) * this.c_noiseSecondaryNoteHueScale) / this.c_noiseChannelCountOverride) * 256) % colorFormulaNoiseLimit) + ","
                        + (this.c_noiseSecondaryNoteSat + color * this.c_noiseSecondaryNoteSatScale) + "%,"
                        + (this.c_noiseSecondaryNoteLum + color * this.c_noiseSecondaryNoteLumScale) + "%)";
                    let newNotePrimary = "hsl(" + ((this.c_noisePrimaryNoteHue + (((color - song.pitchChannelCount) * this.c_noisePrimaryNoteHueScale) / this.c_noiseChannelCountOverride) * 256) % colorFormulaNoiseLimit) + ","
                        + (this.c_noisePrimaryNoteSat + color * this.c_noisePrimaryNoteSatScale) + "%,"
                        + (this.c_noisePrimaryNoteLum + color * this.c_noisePrimaryNoteLumScale) + "%)";

                    let newChannelColors = <ChannelColors>{ secondaryChannel: newChannelSecondary, primaryChannel: newChannelPrimary, secondaryNote: newNoteSecondary, primaryNote: newNotePrimary };
                    ColorConfig.colorLookup.set(color, newChannelColors);
                    return newChannelColors;
                }
                else {
                    // Mod formula

                    let newChannelSecondary = "hsl(" + ((this.c_modSecondaryChannelHue + (((color - song.pitchChannelCount - song.noiseChannelCount) * this.c_modSecondaryChannelHueScale) / this.c_modChannelCountOverride) * 256) % colorFormulaModLimit) + ","
                        + (this.c_modSecondaryChannelSat + color * this.c_modSecondaryChannelSatScale) + "%,"
                        + (this.c_modSecondaryChannelLum + color * this.c_modSecondaryChannelLumScale) + "%)";
                    let newChannelPrimary = "hsl(" + ((this.c_modPrimaryChannelHue + (((color - song.pitchChannelCount - song.noiseChannelCount) * this.c_modPrimaryChannelHueScale) / this.c_modChannelCountOverride) * 256) % colorFormulaModLimit) + ","
                        + (this.c_modPrimaryChannelSat + color * this.c_modPrimaryChannelSatScale) + "%,"
                        + (this.c_modPrimaryChannelLum + color * this.c_modPrimaryChannelLumScale) + "%)";
                    let newNoteSecondary = "hsl(" + ((this.c_modSecondaryNoteHue + (((color - song.pitchChannelCount - song.noiseChannelCount) * this.c_modSecondaryNoteHueScale) / this.c_modChannelCountOverride) * 256) % colorFormulaModLimit) + ","
                        + (this.c_modSecondaryNoteSat + color * this.c_modSecondaryNoteSatScale) + "%,"
                        + (this.c_modSecondaryNoteLum + color * this.c_modSecondaryNoteLumScale) + "%)";
                    let newNotePrimary = "hsl(" + ((this.c_modPrimaryNoteHue + (((color - song.pitchChannelCount - song.noiseChannelCount) * this.c_modPrimaryNoteHueScale) / this.c_modChannelCountOverride) * 256) % colorFormulaModLimit) + ","
                        + (this.c_modPrimaryNoteSat + color * this.c_modPrimaryNoteSatScale) + "%,"
                        + (this.c_modPrimaryNoteLum + color * this.c_modPrimaryNoteLumScale) + "%)";

                    let newChannelColors = <ChannelColors>{ secondaryChannel: newChannelSecondary, primaryChannel: newChannelPrimary, secondaryNote: newNoteSecondary, primaryNote: newNotePrimary };
                    ColorConfig.colorLookup.set(color, newChannelColors);
                    return newChannelColors;
                }
            }
        }
    }

    private static readonly _styleElement = document.head.appendChild(HTML.style({ type: "text/css" }));

    static setTheme(name: string): void {
        let theme = this.themes[name];
        if (theme == undefined) theme = this.themes[this.defaultTheme];
        this._styleElement.textContent = theme;

        // for getComputed
        let valuesToAdd = ":root{";

        if (this.getComputed("--oscilloscope-line-L") == "") valuesToAdd += "--oscilloscope-line-L:var(--primary-text,white);";
        if (this.getComputed("--oscilloscope-line-R") == "") valuesToAdd += "--oscilloscope-line-R:var(--text-selection,rgba(119,68,255,0.99));";
        if (this.getComputed("--text-enabled-icon") == "") valuesToAdd += "--text-enabled-icon:✓ ;";
        if (this.getComputed("--text-disabled-icon") == "") valuesToAdd += "--text-disabled-icon:　;";
        if (this.getComputed("--text-spacing-icon") == "") valuesToAdd += "--text-spacing-icon:　;";
        if (this.getComputed("--note-flash") == "") valuesToAdd += "--note-flash:#ffffff;";
        if (this.getComputed("--note-flash-secondary") == "") valuesToAdd += "--note-flash-secondary:#ffffff77;";
        if (this.getComputed("--pitch-channel-limit") == "") valuesToAdd += "--pitch-channel-limit:" + Config.pitchChannelCountMax + ";";
        if (this.getComputed("--noise-channel-limit") == "") valuesToAdd += "--noise-channel-limit:" + Config.noiseChannelCountMax + ";";
        if (this.getComputed("--mod-channel-limit") == "") valuesToAdd += "--mod-channel-limit:" + Config.modChannelCountMax + ";";
        if (this.getComputed("--formula-pitch-channel-limit") == "") valuesToAdd += "--formula-pitch-channel-limit:360;";
        if (this.getComputed("--formula-noise-channel-limit") == "") valuesToAdd += "--formula-noise-channel-limit:360;";
        if (this.getComputed("--formula-mod-channel-limit") == "") valuesToAdd += "--formula-mod-channel-limit:360;";
        if (this.getComputed("--editor-background") == "") valuesToAdd += "--editor-background:black;";
        if (this.getComputed("--ui-widget-background") == "") valuesToAdd += "--ui-widget-background:#444;";
        if (this.getComputed("--loop-accent") == "") valuesToAdd += "--loop-accent:#74f;";
        // if (this.getComputed("--link-accent") == "") valuesToAdd += "--link-accent:#9c64f7;";
        // if (this.getComputed("--mod-title") == "") valuesToAdd += "--mod-title:var(--link-accent);";
        if (this.getComputed("--box-selection-fill") == "") valuesToAdd += "--box-selection-fill:rgba(255,255,255,0.2);";
        if (this.getComputed("--primary-text") == "") valuesToAdd += "--primary-text:white;";
        if (this.getComputed("--inverted-text") == "") valuesToAdd += "--inverted-text:black;";
        if (this.getComputed("--track-editor-bg-pitch") == "") valuesToAdd += "--track-editor-bg-pitch:#444;";
        if (this.getComputed("--track-editor-bg-pitch-dim") == "") valuesToAdd += "--track-editor-bg-pitch-dim:#333;";
        if (this.getComputed("--track-editor-bg-noise") == "") valuesToAdd += "--track-editor-bg-noise:#444;";
        if (this.getComputed("--track-editor-bg-noise-dim") == "") valuesToAdd += "--track-editor-bg-noise-dim:#333;";
        if (this.getComputed("--track-editor-bg-mod") == "") valuesToAdd += "--track-editor-bg-mod:#234;";
        if (this.getComputed("--track-editor-bg-mod-dim") == "") valuesToAdd += "--track-editor-bg-mod-dim:#123;";
        if (this.getComputed("--mute-button-normal") == "") valuesToAdd += "--mute-button-normal:#ffa033;";
        if (this.getComputed("--mute-button-mod") == "") valuesToAdd += "--mute-button-mod:#9a6bff;";

        if (this.getComputed("--pitch1-secondary-channel") == "") valuesToAdd += "--pitch1-secondary-channel:#0099A1;";
        if (this.getComputed("--pitch1-primary-channel") == "") valuesToAdd += "--pitch1-primary-channel:#25F3FF;";
        if (this.getComputed("--pitch1-secondary-note") == "") valuesToAdd += "--pitch1-secondary-note:#00BDC7;";
        if (this.getComputed("--pitch1-primary-note") == "") valuesToAdd += "--pitch1-primary-note:#92F9FF;";
        if (this.getComputed("--pitch2-secondary-channel") == "") valuesToAdd += "--pitch2-secondary-channel:#A1A100;";
        if (this.getComputed("--pitch2-primary-channel") == "") valuesToAdd += "--pitch2-primary-channel:#FFFF25;";
        if (this.getComputed("--pitch2-secondary-note") == "") valuesToAdd += "--pitch2-secondary-note:#C7C700;";
        if (this.getComputed("--pitch2-primary-note") == "") valuesToAdd += "--pitch2-primary-note:#FFFF92;";
        if (this.getComputed("--pitch3-secondary-channel") == "") valuesToAdd += "--pitch3-secondary-channel:#C75000;";
        if (this.getComputed("--pitch3-primary-channel") == "") valuesToAdd += "--pitch3-primary-channel:#FF9752;";
        if (this.getComputed("--pitch3-secondary-note") == "") valuesToAdd += "--pitch3-secondary-note:#FF771C;";
        if (this.getComputed("--pitch3-primary-note") == "") valuesToAdd += "--pitch3-primary-note:#FFCDAB;";
        if (this.getComputed("--pitch4-secondary-channel") == "") valuesToAdd += "--pitch4-secondary-channel:#00A100;";
        if (this.getComputed("--pitch4-primary-channel") == "") valuesToAdd += "--pitch4-primary-channel:#50FF50;";
        if (this.getComputed("--pitch4-secondary-note") == "") valuesToAdd += "--pitch4-secondary-note:#00C700;";
        if (this.getComputed("--pitch4-primary-note") == "") valuesToAdd += "--pitch4-primary-note:#A0FFA0;";
        if (this.getComputed("--pitch5-secondary-channel") == "") valuesToAdd += "--pitch5-secondary-channel:#D020D0;";
        if (this.getComputed("--pitch5-primary-channel") == "") valuesToAdd += "--pitch5-primary-channel:#FF90FF;";
        if (this.getComputed("--pitch5-secondary-note") == "") valuesToAdd += "--pitch5-secondary-note:#E040E0;";
        if (this.getComputed("--pitch5-primary-note") == "") valuesToAdd += "--pitch5-primary-note:#FFC0FF;";
        if (this.getComputed("--pitch6-secondary-channel") == "") valuesToAdd += "--pitch6-secondary-channel:#7777B0;";
        if (this.getComputed("--pitch6-primary-channel") == "") valuesToAdd += "--pitch6-primary-channel:#A0A0FF;";
        if (this.getComputed("--pitch6-secondary-note") == "") valuesToAdd += "--pitch6-secondary-note:#8888D0;";
        if (this.getComputed("--pitch6-primary-note") == "") valuesToAdd += "--pitch6-primary-note:#D0D0FF;";
        if (this.getComputed("--pitch7-secondary-channel") == "") valuesToAdd += "--pitch7-secondary-channel:#8AA100;";
        if (this.getComputed("--pitch7-primary-channel") == "") valuesToAdd += "--pitch7-primary-channel:#DEFF25;";
        if (this.getComputed("--pitch7-secondary-note") == "") valuesToAdd += "--pitch7-secondary-note:#AAC700;";
        if (this.getComputed("--pitch7-primary-note") == "") valuesToAdd += "--pitch7-primary-note:#E6FF92;";
        if (this.getComputed("--pitch8-secondary-channel") == "") valuesToAdd += "--pitch8-secondary-channel:#DF0019;";
        if (this.getComputed("--pitch8-primary-channel") == "") valuesToAdd += "--pitch8-primary-channel:#FF98A4;";
        if (this.getComputed("--pitch8-secondary-note") == "") valuesToAdd += "--pitch8-secondary-note:#FF4E63;";
        if (this.getComputed("--pitch8-primary-note") == "") valuesToAdd += "--pitch8-primary-note:#FFB2BB;";
        if (this.getComputed("--pitch9-secondary-channel") == "") valuesToAdd += "--pitch9-secondary-channel:#00A170;";
        if (this.getComputed("--pitch9-primary-channel") == "") valuesToAdd += "--pitch9-primary-channel:#50FFC9;";
        if (this.getComputed("--pitch9-secondary-note") == "") valuesToAdd += "--pitch9-secondary-note:#00C78A;";
        if (this.getComputed("--pitch9-primary-note") == "") valuesToAdd += "--pitch9-primary-note:#83FFD9;";
        if (this.getComputed("--pitch10-secondary-channel") == "") valuesToAdd += "--pitch10-secondary-channel:#A11FFF;";
        if (this.getComputed("--pitch10-primary-channel") == "") valuesToAdd += "--pitch10-primary-channel:#CE8BFF;";
        if (this.getComputed("--pitch10-secondary-note") == "") valuesToAdd += "--pitch10-secondary-note:#B757FF;";
        if (this.getComputed("--pitch10-primary-note") == "") valuesToAdd += "--pitch10-primary-note:#DFACFF;";

        if (this.getComputed("--noise1-secondary-channel") == "") valuesToAdd += "--noise1-secondary-channel:#6F6F6F;";
        if (this.getComputed("--noise1-primary-channel") == "") valuesToAdd += "--noise1-primary-channel:#AAAAAA;";
        if (this.getComputed("--noise1-secondary-note") == "") valuesToAdd += "--noise1-secondary-note:#A7A7A7;";
        if (this.getComputed("--noise1-primary-note") == "") valuesToAdd += "--noise1-primary-note:#E0E0E0;";
        if (this.getComputed("--noise2-secondary-channel") == "") valuesToAdd += "--noise2-secondary-channel:#996633;";
        if (this.getComputed("--noise2-primary-channel") == "") valuesToAdd += "--noise2-primary-channel:#DDAA77;";
        if (this.getComputed("--noise2-secondary-note") == "") valuesToAdd += "--noise2-secondary-note:#CC9966;";
        if (this.getComputed("--noise2-primary-note") == "") valuesToAdd += "--noise2-primary-note:#F0D0BB;";
        if (this.getComputed("--noise3-secondary-channel") == "") valuesToAdd += "--noise3-secondary-channel:#4A6D8F;";
        if (this.getComputed("--noise3-primary-channel") == "") valuesToAdd += "--noise3-primary-channel:#77AADD;";
        if (this.getComputed("--noise3-secondary-note") == "") valuesToAdd += "--noise3-secondary-note:#6F9FCF;";
        if (this.getComputed("--noise3-primary-note") == "") valuesToAdd += "--noise3-primary-note:#BBD7FF;";
        if (this.getComputed("--noise4-secondary-channel") == "") valuesToAdd += "--noise4-secondary-channel:#7A4F9A;";
        if (this.getComputed("--noise4-primary-channel") == "") valuesToAdd += "--noise4-primary-channel:#AF82D2;";
        if (this.getComputed("--noise4-secondary-note") == "") valuesToAdd += "--noise4-secondary-note:#9E71C1;";
        if (this.getComputed("--noise4-primary-note") == "") valuesToAdd += "--noise4-primary-note:#D4C1EA;";
        if (this.getComputed("--noise5-secondary-channel") == "") valuesToAdd += "--noise5-secondary-channel:#607837;";
        if (this.getComputed("--noise5-primary-channel") == "") valuesToAdd += "--noise5-primary-channel:#A2BB77;";
        if (this.getComputed("--noise5-secondary-note") == "") valuesToAdd += "--noise5-secondary-note:#91AA66;";
        if (this.getComputed("--noise5-primary-note") == "") valuesToAdd += "--noise5-primary-note:#C5E2B2;";

        if (this.getComputed("--mod1-secondary-channel") == "") valuesToAdd += "--mod1-secondary-channel:#339955;";
        if (this.getComputed("--mod1-primary-channel") == "") valuesToAdd += "--mod1-primary-channel:#77fc55;";
        if (this.getComputed("--mod1-secondary-note") == "") valuesToAdd += "--mod1-secondary-note:#77ff8a;";
        if (this.getComputed("--mod1-primary-note") == "") valuesToAdd += "--mod1-primary-note:#cdffee;";
        if (this.getComputed("--mod2-secondary-channel") == "") valuesToAdd += "--mod2-secondary-channel:#993355;";
        if (this.getComputed("--mod2-primary-channel") == "") valuesToAdd += "--mod2-primary-channel:#f04960;";
        if (this.getComputed("--mod2-secondary-note") == "") valuesToAdd += "--mod2-secondary-note:#f057a0;";
        if (this.getComputed("--mod2-primary-note") == "") valuesToAdd += "--mod2-primary-note:#ffb8de;";
        if (this.getComputed("--mod3-secondary-channel") == "") valuesToAdd += "--mod3-secondary-channel:#553399;";
        if (this.getComputed("--mod3-primary-channel") == "") valuesToAdd += "--mod3-primary-channel:#8855fc;";
        if (this.getComputed("--mod3-secondary-note") == "") valuesToAdd += "--mod3-secondary-note:#aa64ff;";
        if (this.getComputed("--mod3-primary-note") == "") valuesToAdd += "--mod3-primary-note:#f8ddff;";
        if (this.getComputed("--mod4-secondary-channel") == "") valuesToAdd += "--mod4-secondary-channel:#a86436;";
        if (this.getComputed("--mod4-primary-channel") == "") valuesToAdd += "--mod4-primary-channel:#c8a825;";
        if (this.getComputed("--mod4-secondary-note") == "") valuesToAdd += "--mod4-secondary-note:#e8ba46;";
        if (this.getComputed("--mod4-primary-note") == "") valuesToAdd += "--mod4-primary-note:#fff6d3;";

        valuesToAdd += "}";
        this._styleElement.textContent = valuesToAdd + this._styleElement.textContent;

        const themeColor = <HTMLMetaElement>document.querySelector("meta[name='theme-color']");
        if (themeColor != null) {
            themeColor.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue('--ui-widget-background'));
        }

        this.resetColors();

        this.usesColorFormula = (this.getComputed("--use-color-formula").trim() == "true");

        this.c_pitchLimit = +this.getComputed("--pitch-channel-limit");
        this.c_noiseLimit = +this.getComputed("--noise-channel-limit");
        this.c_modLimit = +this.getComputed("--mod-channel-limit");
        this.c_colorFormulaPitchLimit = +this.getComputed("--formula-pitch-channel-limit");
        this.c_colorFormulaNoiseLimit = +this.getComputed("--formula-noise-channel-limit");
        this.c_colorFormulaModLimit = +this.getComputed("--formula-mod-channel-limit");

        this.c_invertedText = this.getComputed("--inverted-text");
        this.c_trackEditorBgNoiseDim = this.getComputed("--track-editor-bg-noise-dim");
        this.c_trackEditorBgNoise = this.getComputed("--track-editor-bg-noise");
        this.c_trackEditorBgModDim = this.getComputed("--track-editor-bg-mod-dim");
        this.c_trackEditorBgMod = this.getComputed("--track-editor-bg-mod");
        this.c_trackEditorBgPitchDim = this.getComputed("--track-editor-bg-pitch-dim");
        this.c_trackEditorBgPitch = this.getComputed("--track-editor-bg-pitch");

        if (this.usesColorFormula) {
            this.c_pitchSecondaryChannelHue = +this.getComputed("--pitch-secondary-channel-hue");
            this.c_pitchSecondaryChannelHueScale = +this.getComputed("--pitch-secondary-channel-hue-scale");
            this.c_pitchSecondaryChannelSat = +this.getComputed("--pitch-secondary-channel-sat");
            this.c_pitchSecondaryChannelSatScale = +this.getComputed("--pitch-secondary-channel-sat-scale");
            this.c_pitchSecondaryChannelLum = +this.getComputed("--pitch-secondary-channel-lum");
            this.c_pitchSecondaryChannelLumScale = +this.getComputed("--pitch-secondary-channel-lum-scale");
            this.c_pitchPrimaryChannelHue = +this.getComputed("--pitch-primary-channel-hue");
            this.c_pitchPrimaryChannelHueScale = +this.getComputed("--pitch-primary-channel-hue-scale");
            this.c_pitchPrimaryChannelSat = +this.getComputed("--pitch-primary-channel-sat");
            this.c_pitchPrimaryChannelSatScale = +this.getComputed("--pitch-primary-channel-sat-scale");
            this.c_pitchPrimaryChannelLum = +this.getComputed("--pitch-primary-channel-lum");
            this.c_pitchPrimaryChannelLumScale = +this.getComputed("--pitch-primary-channel-lum-scale");
            this.c_pitchSecondaryNoteHue = +this.getComputed("--pitch-secondary-note-hue");
            this.c_pitchSecondaryNoteHueScale = +this.getComputed("--pitch-secondary-note-hue-scale");
            this.c_pitchSecondaryNoteSat = +this.getComputed("--pitch-secondary-note-sat");
            this.c_pitchSecondaryNoteSatScale = +this.getComputed("--pitch-secondary-note-sat-scale");
            this.c_pitchSecondaryNoteLum = +this.getComputed("--pitch-secondary-note-lum");
            this.c_pitchSecondaryNoteLumScale = +this.getComputed("--pitch-secondary-note-lum-scale");
            this.c_pitchPrimaryNoteHue = +this.getComputed("--pitch-primary-note-hue");
            this.c_pitchPrimaryNoteHueScale = +this.getComputed("--pitch-primary-note-hue-scale");
            this.c_pitchPrimaryNoteSat = +this.getComputed("--pitch-primary-note-sat");
            this.c_pitchPrimaryNoteSatScale = +this.getComputed("--pitch-primary-note-sat-scale");
            this.c_pitchPrimaryNoteLum = +this.getComputed("--pitch-primary-note-lum");
            this.c_pitchPrimaryNoteLumScale = +this.getComputed("--pitch-primary-note-lum-scale");

            this.c_noiseSecondaryChannelHue = +this.getComputed("--noise-secondary-channel-hue");
            this.c_noiseSecondaryChannelHueScale = +this.getComputed("--noise-secondary-channel-hue-scale");
            this.c_noiseSecondaryChannelSat = +this.getComputed("--noise-secondary-channel-sat");
            this.c_noiseSecondaryChannelSatScale = +this.getComputed("--noise-secondary-channel-sat-scale");
            this.c_noiseSecondaryChannelLum = +this.getComputed("--noise-secondary-channel-lum");
            this.c_noiseSecondaryChannelLumScale = +this.getComputed("--noise-secondary-channel-lum-scale");
            this.c_noisePrimaryChannelHue = +this.getComputed("--noise-primary-channel-hue");
            this.c_noisePrimaryChannelHueScale = +this.getComputed("--noise-primary-channel-hue-scale");
            this.c_noisePrimaryChannelSat = +this.getComputed("--noise-primary-channel-sat");
            this.c_noisePrimaryChannelSatScale = +this.getComputed("--noise-primary-channel-sat-scale");
            this.c_noisePrimaryChannelLum = +this.getComputed("--noise-primary-channel-lum");
            this.c_noisePrimaryChannelLumScale = +this.getComputed("--noise-primary-channel-lum-scale");
            this.c_noiseSecondaryNoteHue = +this.getComputed("--noise-secondary-note-hue");
            this.c_noiseSecondaryNoteHueScale = +this.getComputed("--noise-secondary-note-hue-scale");
            this.c_noiseSecondaryNoteSat = +this.getComputed("--noise-secondary-note-sat");
            this.c_noiseSecondaryNoteSatScale = +this.getComputed("--noise-secondary-note-sat-scale");
            this.c_noiseSecondaryNoteLum = +this.getComputed("--noise-secondary-note-lum");
            this.c_noiseSecondaryNoteLumScale = +this.getComputed("--noise-secondary-note-lum-scale");
            this.c_noisePrimaryNoteHue = +this.getComputed("--noise-primary-note-hue");
            this.c_noisePrimaryNoteHueScale = +this.getComputed("--noise-primary-note-hue-scale");
            this.c_noisePrimaryNoteSat = +this.getComputed("--noise-primary-note-sat");
            this.c_noisePrimaryNoteSatScale = +this.getComputed("--noise-primary-note-sat-scale");
            this.c_noisePrimaryNoteLum = +this.getComputed("--noise-primary-note-lum");
            this.c_noisePrimaryNoteLumScale = +this.getComputed("--noise-primary-note-lum-scale");

            this.c_modSecondaryChannelHue = +this.getComputed("--mod-secondary-channel-hue");
            this.c_modSecondaryChannelHueScale = +this.getComputed("--mod-secondary-channel-hue-scale");
            this.c_modSecondaryChannelSat = +this.getComputed("--mod-secondary-channel-sat");
            this.c_modSecondaryChannelSatScale = +this.getComputed("--mod-secondary-channel-sat-scale");
            this.c_modSecondaryChannelLum = +this.getComputed("--mod-secondary-channel-lum");
            this.c_modSecondaryChannelLumScale = +this.getComputed("--mod-secondary-channel-lum-scale");
            this.c_modPrimaryChannelHue = +this.getComputed("--mod-primary-channel-hue");
            this.c_modPrimaryChannelHueScale = +this.getComputed("--mod-primary-channel-hue-scale");
            this.c_modPrimaryChannelSat = +this.getComputed("--mod-primary-channel-sat");
            this.c_modPrimaryChannelSatScale = +this.getComputed("--mod-primary-channel-sat-scale");
            this.c_modPrimaryChannelLum = +this.getComputed("--mod-primary-channel-lum");
            this.c_modPrimaryChannelLumScale = +this.getComputed("--mod-primary-channel-lum-scale");
            this.c_modSecondaryNoteHue = +this.getComputed("--mod-secondary-note-hue");
            this.c_modSecondaryNoteHueScale = +this.getComputed("--mod-secondary-note-hue-scale");
            this.c_modSecondaryNoteSat = +this.getComputed("--mod-secondary-note-sat");
            this.c_modSecondaryNoteSatScale = +this.getComputed("--mod-secondary-note-sat-scale");
            this.c_modSecondaryNoteLum = +this.getComputed("--mod-secondary-note-lum");
            this.c_modSecondaryNoteLumScale = +this.getComputed("--mod-secondary-note-lum-scale");
            this.c_modPrimaryNoteHue = +this.getComputed("--mod-primary-note-hue");
            this.c_modPrimaryNoteHueScale = +this.getComputed("--mod-primary-note-hue-scale");
            this.c_modPrimaryNoteSat = +this.getComputed("--mod-primary-note-sat");
            this.c_modPrimaryNoteSatScale = +this.getComputed("--mod-primary-note-sat-scale");
            this.c_modPrimaryNoteLum = +this.getComputed("--mod-primary-note-lum");
            this.c_modPrimaryNoteLumScale = +this.getComputed("--mod-primary-note-lum-scale");

            if (this.getComputed("--formula-pitch-channel-count-override") != "") this.c_pitchChannelCountOverride = +this.getComputed("--formula-pitch-channel-count-override");
            if (this.getComputed("--formula-noise-channel-count-override") != "") this.c_noiseChannelCountOverride = +this.getComputed("--formula-noise-channel-count-override");
            if (this.getComputed("--formula-mod-channel-count-override") != "") this.c_modChannelCountOverride = +this.getComputed("--formula-mod-channel-count-override");
        }

    }

    static getComputed(name: string): string {
        return getComputedStyle(this._styleElement).getPropertyValue(name);
    }
}
